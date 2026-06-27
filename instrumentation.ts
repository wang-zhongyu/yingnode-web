let monitorStarted = false

async function loadHotspotLock() {
  const { isManualHotspotLocked } = await import(
    "@/shared/lib/hotspot-lock"
  )
  return isManualHotspotLocked
}

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

    const isManualHotspotLocked = await loadHotspotLock()
    startNetworkMonitor(networkService, isManualHotspotLocked)

    // Add: start metrics collector
    const { startMetricsCollector } = await import(
      "@/features/monitoring/lib/metrics-collector"
    )
    startMetricsCollector()
  }
}

function startNetworkMonitor(
  networkService: {
    isOnline(): Promise<boolean>
    getStatus(): Promise<{
      status: string
      hotspotActive: boolean
      lastCheck: string
      currentSSID: string | null
      ipAddress: string | null
    }>
    startHotspot(): Promise<void>
    stopHotspot(): Promise<void>
    updateDB(fields: Record<string, unknown>): Promise<void>
    ensureInterfaceReady(opts?: {
      skipApModeCheck?: boolean
    }): Promise<{ ok: boolean; reason?: string }>
    hasExternalIp(): Promise<boolean>
  },
  isManualHotspotLocked: () => boolean,
) {
  let consecutiveFailures = 0
  let consecutiveSuccesses = 0

  const check = async () => {
    try {
      // Verify interface is in correct state before connectivity checks
      // Skip AP mode check — don't kill a running hotspot
      const ready = await networkService.ensureInterfaceReady({
        skipApModeCheck: true,
      })
      if (!ready.ok) {
        console.warn(`[monitor] Interface not ready: ${ready.reason}; skipping tick`)
        return
      }

      const online = await networkService.isOnline()
      const status = await networkService.getStatus()

      if (online) {
        consecutiveFailures = 0
        consecutiveSuccesses++

        if (status.hotspotActive && consecutiveSuccesses >= 3) {
          if (isManualHotspotLocked()) {
            console.log("[monitor] Hotspot locked, skipping stopHotspot")
          } else {
            await networkService.stopHotspot()
            consecutiveSuccesses = 0
          }
        }
      } else {
        consecutiveSuccesses = 0
        consecutiveFailures++

        if (!status.hotspotActive && consecutiveFailures >= 3) {
          if (isManualHotspotLocked()) {
            console.log("[monitor] Hotspot locked, skipping startHotspot")
          } else {
            // Safeguard: don't start hotspot if already connected to an external network
            // (e.g. WiFi connected but ping/DNS blocked by firewall — device is still online)
            const hasExternal = await networkService.hasExternalIp()
            if (hasExternal) {
              console.log("[monitor] External IP detected, skipping startHotspot")
              consecutiveFailures = 0
            } else {
              await networkService.startHotspot()
            }
          }
        }

        if (status.status !== "HOTSPOT_ACTIVE" && consecutiveFailures >= 3) {
          await networkService.updateDB({ status: "OFFLINE" })
        }
      }
    } catch (error) {
      console.error("[monitor] check error:", error)
    }
  }

  check()
  setInterval(check, 10_000)
}
