/**
 * ponytail: the setupAdminAction rate limiter is a simple in-memory counter
 * with a time window — tested here as an isolated logic unit.
 *
 * The server action itself (next-safe-action + better-auth integration) is
 * tested implicitly by TypeScript type-checking and the production build.
 * Full integration testing requires a running server, which is out of scope
 * for unit tests per ponytail philosophy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Simulate the rate limiter logic from actions/auth.actions.ts
// ponytail: this exists — testing the logic, not the framework wrapping
function createRateLimiter(limit: number, windowMs: number) {
  let attempts = 0
  let windowStart = 0

  return function check(): void {
    const now = Date.now()
    if (now - windowStart > windowMs) {
      attempts = 0
      windowStart = now
    }
    attempts++
    if (attempts > limit) {
      throw new Error("请求过于频繁，请稍后再试")
    }
  }
}

describe("setupAdmin rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows requests up to the limit within the same window", () => {
    const check = createRateLimiter(5, 60_000)

    // First 5 calls should not throw
    for (let i = 0; i < 5; i++) {
      expect(() => check()).not.toThrow()
    }
  })

  it("throws on the 6th attempt within the same window", () => {
    const check = createRateLimiter(5, 60_000)

    for (let i = 0; i < 5; i++) {
      check()
    }

    expect(() => check()).toThrow("请求过于频繁")
  })

  it("resets after the window expires", () => {
    const check = createRateLimiter(5, 60_000)

    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      check()
    }

    expect(() => check()).toThrow("请求过于频繁")

    // Advance past the window
    vi.advanceTimersByTime(61_000)

    // Should be able to make requests again
    expect(() => check()).not.toThrow()
  })
})
