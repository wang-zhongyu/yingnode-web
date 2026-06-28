import { describe, it, expect } from "vitest"
import { escapeRegex } from "@/shared/lib/network/constants"

describe("escapeRegex", () => {
  it("escapes all special regex characters", () => {
    expect(escapeRegex(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    )
  })

  it("passes through normal text unchanged", () => {
    expect(escapeRegex("yingnode")).toBe("yingnode")
  })
})
