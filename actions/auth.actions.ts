"use server"

import { actionClient, authActionClient } from "@/shared/lib/safe-action"
import { setupSchema, changePasswordSchema } from "@/features/auth/schemas/auth.schema"
import { checkUsersExist } from "@/features/auth/lib/check-users-exist"
import { auth } from "@/shared/lib/auth"
import { headers } from "next/headers"

// ponytail: simple in-memory rate limiter — 5 setup attempts per minute
let setupAttempts = 0
let setupWindowStart = 0
const SETUP_RATE_LIMIT = 5
const SETUP_WINDOW_MS = 60_000

function checkSetupRateLimit(): void {
  const now = Date.now()
  if (now - setupWindowStart > SETUP_WINDOW_MS) {
    setupAttempts = 0
    setupWindowStart = now
  }
  setupAttempts++
  if (setupAttempts > SETUP_RATE_LIMIT) {
    throw new Error("请求过于频繁，请稍后再试")
  }
}

export const setupAdminAction = actionClient
  .schema(setupSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    checkSetupRateLimit()

    const usersExist = await checkUsersExist()

    if (usersExist) {
      throw new Error("已存在管理员账户，无法重复初始化")
    }

    const result = await auth.api.signUpEmail({
      body: {
        name: email.split("@")[0] ?? "Admin",
        email,
        password,
        // additionalFields from better-auth config
        ...({ role: "admin" } as Record<string, unknown>),
      },
      headers: await headers(),
    })

    if (!result) {
      throw new Error("创建管理员账户失败")
    }

    return result
  })

export const changePasswordAction = authActionClient
  .schema(changePasswordSchema)
  .action(async ({ parsedInput: { currentPassword, newPassword } }) => {
    const result = await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    })

    if (!result) {
      throw new Error("密码修改失败，请检查当前密码是否正确")
    }

    return result
  })
