/**
 * ponytail: metrics-collector has module-level `collectorStarted` guard and
 * `cleanupCounter` state. We verify the full lifecycle in one test to avoid
 * state leakage between test cases.
 */
import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    metricsSnapshot: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

vi.mock("@/shared/lib/system-monitor", () => ({
  systemMonitor: {
    getMetrics: vi.fn().mockResolvedValue({
      cpu: { usage: 42.5 },
      memory: { total: 8_000_000_000, used: 4_000_000_000 },
      disk: { total: 64_000_000_000, used: 32_000_000_000 },
      temp: { celsius: 55 },
    }),
  },
}))

import { startMetricsCollector } from "@/features/monitoring/lib/metrics-collector"
import { prisma } from "@/shared/lib/prisma"

describe("metricsCollector", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("collects snapshots and cleans up every 60th tick", async () => {
    vi.useFakeTimers()
    startMetricsCollector()

    // Flush initial collect() microtask
    await vi.advanceTimersByTimeAsync(0)
    expect(prisma.metricsSnapshot.create).toHaveBeenCalledTimes(1)

    // 58 more ticks → total = 59, no cleanup yet
    for (let i = 0; i < 58; i++) {
      await vi.advanceTimersByTimeAsync(60_000)
    }
    expect(prisma.metricsSnapshot.deleteMany).not.toHaveBeenCalled()

    // 60th tick → cleanup triggers
    await vi.advanceTimersByTimeAsync(60_000)
    expect(prisma.metricsSnapshot.deleteMany).toHaveBeenCalledWith({
      where: { timestamp: { lt: expect.any(Date) } },
    })

    vi.useRealTimers()
  })
})
