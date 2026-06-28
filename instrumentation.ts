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

    // Static IP 172.16.42.1 is only bound during hotspot mode (in startHotspotInternal).
    // If WiFi is unavailable at boot, the monitor will start hotspot immediately.

    const { isManualHotspotLocked } = await import("@/shared/lib/hotspot-lock")
    const { startNetworkMonitor } = await import("@/features/network/lib/network-monitor")
    startNetworkMonitor(networkService, isManualHotspotLocked)

    // Add: start metrics collector
    const { startMetricsCollector } = await import(
      "@/features/monitoring/lib/metrics-collector"
    )
    startMetricsCollector()
  }
}
