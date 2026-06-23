"use server"

import { actionClient } from "@/shared/lib/safe-action"
import { setupSchema } from "@/features/auth/schemas/auth.schema"
import { checkUsersExist } from "@/features/auth/lib/check-users-exist"
import { auth } from "@/shared/lib/auth"
import { headers } from "next/headers"

export const setupAdminAction = actionClient
  .schema(setupSchema)
  .action(async ({ parsedInput: { email, password } }) => {
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
