import { vi } from "vitest"

// ponytail: minimal prisma mock — each test file customizes the specific
// model methods it needs via vi.mocked().

const mockPrisma = {
  networkStatus: {
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
  },
  deviceConfig: {
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
  },
  wiFiRecord: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  user: {
    count: vi.fn().mockResolvedValue(0),
  },
  metricsSnapshot: {
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  $queryRaw: vi.fn().mockResolvedValue([]),
}

vi.mock("@/shared/lib/prisma", () => ({
  prisma: mockPrisma,
}))

export { mockPrisma }
