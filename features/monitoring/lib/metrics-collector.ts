// features/monitoring/lib/metrics-collector.ts
import { prisma } from "@/shared/lib/prisma"
import { systemMonitor } from "@/shared/lib/system-monitor"

let collectorStarted = false

export function startMetricsCollector(): void {
  if (collectorStarted) return
  collectorStarted = true

  async function collect() {
    try {
      const metrics = await systemMonitor.getMetrics()

      await prisma.metricsSnapshot.create({
        data: {
          cpuUsage: metrics.cpu.usage,
          memTotal: BigInt(metrics.memory.total),
          memUsed: BigInt(metrics.memory.used),
          diskTotal: BigInt(metrics.disk.total),
          diskUsed: BigInt(metrics.disk.used),
          tempCelsius: metrics.temp.celsius,
        },
      })

      // Cleanup records older than 24 hours
      await prisma.metricsSnapshot.deleteMany({
        where: {
          timestamp: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      })
    } catch (error) {
      console.error("[metrics-collector] error:", error)
    }
  }

  collect()
  setInterval(collect, 60_000) // every 60 seconds
}
