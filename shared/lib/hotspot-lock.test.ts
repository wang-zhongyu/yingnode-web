import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock prisma before importing hotspot-lock
vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    networkStatus: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { setManualHotspotLock, isManualHotspotLocked } from "@/shared/lib/hotspot-lock"
import { prisma } from "@/shared/lib/prisma"

describe("setManualHotspotLock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("upserts the networkStatus record with manualLock = true", async () => {
    await setManualHotspotLock(true)

    expect(prisma.networkStatus.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { manualLock: true },
      create: { id: 1, manualLock: true },
    })
  })

  it("upserts the networkStatus record with manualLock = false", async () => {
    await setManualHotspotLock(false)

    expect(prisma.networkStatus.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { manualLock: false },
      create: { id: 1, manualLock: false },
    })
  })
})

describe("isManualHotspotLocked", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns true when lock is set in DB", async () => {
    vi.mocked(prisma.networkStatus.findFirst).mockResolvedValue({
      id: 1,
      manualLock: true,
    } as never)

    const result = await isManualHotspotLocked()
    expect(result).toBe(true)
  })

  it("returns false when record does not exist", async () => {
    vi.mocked(prisma.networkStatus.findFirst).mockResolvedValue(null)

    const result = await isManualHotspotLocked()
    expect(result).toBe(false)
  })
})
