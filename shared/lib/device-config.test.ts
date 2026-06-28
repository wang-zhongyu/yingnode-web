import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock prisma before importing device-config
vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    deviceConfig: {
      findFirst: vi.fn(),
    },
  },
}))

import { getDeviceConfig } from "@/shared/lib/device-config"
import { prisma } from "@/shared/lib/prisma"

describe("getDeviceConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns DB config when available", async () => {
    vi.mocked(prisma.deviceConfig.findFirst).mockResolvedValue({
      id: 1,
      wifiInterface: "wlp2s0",
      hotspotIp: "10.0.0.1",
      hotspotSsid: "test-hotspot",
      hotspotPassword: "secret123",
    })

    const config = await getDeviceConfig()
    expect(config.wifiInterface).toBe("wlp2s0")
    expect(config.hotspotIp).toBe("10.0.0.1")
    expect(config.hotspotSsid).toBe("test-hotspot")
    expect(config.hotspotPassword).toBe("secret123")
  })

  it("falls back to env vars when DB throws", async () => {
    vi.mocked(prisma.deviceConfig.findFirst).mockRejectedValue(new Error("no db"))

    const config = await getDeviceConfig()
    // FALLBACK values (from env or defaults)
    expect(config.wifiInterface).toBeDefined()
    expect(config.hotspotIp).toBeDefined()
    expect(config.hotspotSsid).toBeDefined()
  })
})
