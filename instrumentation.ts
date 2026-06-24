let monitorStarted = false

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !monitorStarted) {
    monitorStarted = true

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

    startNetworkMonitor(networkService)

    // Add: start metrics collector
    const { startMetricsCollector } = await import(
      "@/features/monitoring/lib/metrics-collector"
    )
    startMetricsCollector()
  }
}

function startNetworkMonitor(networkService: {
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
  ensureInterfaceReady(): Promise<{ ok: boolean; reason?: string }>
}) {
  let consecutiveFailures = 0
  let consecutiveSuccesses = 0

  const check = async () => {
    try {
      // Verify interface is in correct state before connectivity checks
      const ready = await networkService.ensureInterfaceReady()
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
          await networkService.stopHotspot()
          consecutiveSuccesses = 0
        }
      } else {
        consecutiveSuccesses = 0
        consecutiveFailures++

        if (!status.hotspotActive && consecutiveFailures >= 3) {
          await networkService.startHotspot()
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
