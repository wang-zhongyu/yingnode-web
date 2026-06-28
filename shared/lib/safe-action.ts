import { createSafeActionClient } from "next-safe-action"
import { auth } from "@/shared/lib/auth"
import { headers } from "next/headers"

export const actionClient = createSafeActionClient()

// ponytail: authenticated action client — checks session before executing
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    throw new Error("Unauthorized")
  }

  return next({ ctx: { user: session.user } })
})
