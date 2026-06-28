import { describe, it, expect } from "vitest"
import { escapeShellArg, safeArg } from "@/shared/lib/shell"

describe("escapeShellArg", () => {
  it("escapes single quotes by replacing with '\\'' sequence", () => {
    expect(escapeShellArg("it's")).toBe("it'\\''s")
  })

  it("passes through strings without special characters unchanged", () => {
    expect(escapeShellArg("hello")).toBe("hello")
    expect(escapeShellArg("wlan0")).toBe("wlan0")
  })
})

describe("safeArg", () => {
  it("wraps argument in single quotes and escapes internal quotes", () => {
    expect(safeArg("hello")).toBe("'hello'")
    expect(safeArg("it's")).toBe("'it'\\''s'")
  })
})
