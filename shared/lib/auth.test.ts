import { describe, it, expect } from "vitest"
import { auth } from "@/shared/lib/auth"

describe("auth configuration", () => {
  it("creates a better-auth instance with expected API", () => {
    expect(auth).toBeDefined()
    expect(auth.api).toBeDefined()
    expect(typeof auth.api.getSession).toBe("function")
    expect(auth.api.signUpEmail).toBeDefined()
    expect(auth.api.signInEmail).toBeDefined()
    expect(auth.api.changePassword).toBeDefined()
  })

  it("exposes options through the internal $flags or options", () => {
    // better-auth stores configuration in its internal state.
    // Verify the instance has expected methods available.
    expect(auth.options).toBeDefined()
  })
})
