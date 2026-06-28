import { vi } from "vitest"

// ponytail: minimal shell mock — tests that need different behavior
// can import this and customize vi.mocked() per test case.

vi.mock("@/shared/lib/shell", () => ({
  execAsync: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
  escapeShellArg: vi.fn((s: string) => s.replace(/'/g, "'\\''")),
  safeArg: vi.fn((s: string) => `'${s.replace(/'/g, "'\\''")}'`),
}))
