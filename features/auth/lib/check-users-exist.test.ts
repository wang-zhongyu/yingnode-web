import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock prisma before importing the module under test
vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    user: { count: vi.fn() },
  },
}))

import { checkUsersExist } from "@/features/auth/lib/check-users-exist"
import { prisma } from "@/shared/lib/prisma"

describe("checkUsersExist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns true when user count is greater than 0", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(3)

    const result = await checkUsersExist()
    expect(result).toBe(true)
  })

  it("returns false when no users exist", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)

    const result = await checkUsersExist()
    expect(result).toBe(false)
  })
})
