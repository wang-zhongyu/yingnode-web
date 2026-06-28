import type { NetworkService } from "@/shared/lib/network-service"

let monitorStarted = false

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !monitorStarted) {
    monitorStarted = true

    // Clean up stale temp config files from a previous crash
    try {
      const fs = await import("fs/promises")
      await fs.unlink("/tmp/hostapd-yingnode.conf")
      await fs.unlink("/tmp/dnsmasq-yingnode.conf")
    } catch {
      // files don't exist — normal, nothing to clean
    }

    // Restore NetworkManager management for WiFi interface (leftover from previous crash)
    // Only restore if hostapd is NOT running — we don't want to fight an active hotspot
    try {
      const { execAsync: execAsyncShell } = await import("@/shared/lib/shell")
      const hostapdRunning = await execAsyncShell("pgrep hostapd", 3000)
        .then((r: { stdout: string }) => r.stdout.trim().length > 0)
        .catch(() => false)

      if (!hostapdRunning) {
        const wifiInterface = process.env.WIFI_INTERFACE ?? "wlan0"
        await execAsyncShell(
          `sudo nmcli device set ${wifiInterface} managed yes 2>/dev/null || true`,
          5000,
        )
        console.log("[init] Restored NM management for WiFi interface")
        // Reset stale DB state from previous crash — hostapd is dead
        try {
          const { prisma } = await import("@/shared/lib/prisma")
          await prisma.networkStatus.upsert({
            where: { id: 1 },
            update: { status: "ONLINE", hotspotActive: false },
            create: { id: 1, status: "ONLINE", hotspotActive: false },
          })
          console.log("[init] Reset stale DB status to ONLINE")
        } catch { /* non-fatal */ }
      } else {
        console.log("[init] Hotspot is active, skipping NM recovery")
      }
    } catch { /* NM might not be running — ok */ }

    // Dynamic import — network-service uses Node.js modules
    // (child_process, path, prisma) which are NOT Edge Runtime compatible.
    const { networkService } = await import("@/shared/lib/network-service")

    // Seed hotspot password from env into DB if not set
    if (process.env.HOTSPOT_PASSWORD) {
      try {
        const { prisma } = await import("@/shared/lib/prisma")
        const existing = await prisma.deviceConfig.findFirst({ where: { id: 1 } })
        if (!existing?.hotspotPassword) {
          await prisma.deviceConfig.upsert({
            where: { id: 1 },
            update: { hotspotPassword: process.env.HOTSPOT_PASSWORD },
            create: {
              id: 1,
              hotspotPassword: process.env.HOTSPOT_PASSWORD,
            },
          })
        }
      } catch (err) {
        console.warn("[init] Failed to seed hotspot password:", err)
      }
    }

    // Ensure the device is always reachable on the fixed IP
    await networkService.ensureStaticIp()

    const { isManualHotspotLocked } = await import("@/shared/lib/hotspot-lock")
    startNetworkMonitor(networkService, isManualHotspotLocked)

    // Add: start metrics collector
    const { startMetricsCollector } = await import(
      "@/features/monitoring/lib/metrics-collector"
    )
    startMetricsCollector()
  }
}

function startNetworkMonitor(
  networkService: Pick<
    NetworkService,
    "isWiFiAssociated" | "checkConnectivity" | "getStatus" |
    "startHotspot" | "stopHotspot" | "updateDB" | "unmanageNM" | "remanageNM"
  >,
  isManualHotspotLocked: () => boolean,
) {
  // Debounce counters — only act after N consecutive same-state ticks
  let offlineTicks = 0
  let onlineTicks = 0
  let checking = false

  const check = async () => {
    if (checking) return
    checking = true

    try {
      const status = await networkService.getStatus()
      const associated = await networkService.isWiFiAssociated()
      console.log(
        `[monitor] associated=${associated} status=${status.status} ` +
        `hotspotActive=${status.hotspotActive} offlineTicks=${offlineTicks} onlineTicks=${onlineTicks}`,
      )

      // While hotspot is active, AP mode shows as "not associated" —
      // prevent offlineTicks from accumulating and retriggering start.
      if (status.hotspotActive) {
        offlineTicks = 0
      }

      if (associated) {
        // WiFi is connected to an AP — verify internet access.
        // WiFi reconnected — restore NM if it was unmanaged during offline period
        if (offlineTicks > 0) {
          networkService.remanageNM().catch(() => {})
          networkService.updateDB({ status: "ONLINE" }).catch(() => {})
        }
        offlineTicks = 0
        const pingOk = await networkService.checkConnectivity()

        if (pingOk) {
          onlineTicks++
          // Stop hotspot after 3 consecutive confirmed-online ticks
          if (status.hotspotActive && onlineTicks >= 3) {
            if (isManualHotspotLocked()) {
              console.log("[monitor] Hotspot locked, skipping stopHotspot")
            } else {
              await networkService.stopHotspot()
              onlineTicks = 0
            }
          }
        } else {
          // Associated but no internet (captive portal, firewall)
          // Don't start hotspot — user is on a network, just restricted
          onlineTicks = 0
        }
      } else {
        // WiFi is NOT connected to any AP
        onlineTicks = 0
        offlineTicks++

        // After 2 offline ticks (20s), unmanage NM to prevent it from
        // auto-reconnecting while we count toward hotspot start.
        // Skip if manually locked (user-initiated WiFi connect in progress).
        if (offlineTicks === 2 && !isManualHotspotLocked()) {
          networkService.unmanageNM().catch(() => {})
        }

        if (!status.hotspotActive && offlineTicks >= 3) {
          if (isManualHotspotLocked()) {
            console.log("[monitor] Hotspot locked, skipping startHotspot")
          } else {
            await networkService.startHotspot()
            offlineTicks = 0
          }
        }

        if (status.status !== "HOTSPOT_ACTIVE" && offlineTicks >= 3) {
          await networkService.updateDB({ status: "OFFLINE" })
        }
      }
    } catch (error) {
      console.error("[monitor] check error:", error)
    } finally {
      checking = false
    }
  }

  function scheduleNext() {
    setTimeout(() => {
      check().finally(scheduleNext)
    }, 10_000)
  }

  check()
  scheduleNext()
}
