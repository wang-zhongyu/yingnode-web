"use server"

import { z } from "zod"
import { authActionClient } from "@/shared/lib/safe-action"
import { changeSystemPasswordSchema } from "@/features/ssh/schemas/ssh.schema"
import * as sshService from "@/shared/lib/ssh-service"

export const toggleSshAction = authActionClient
  .schema(z.object({ enable: z.boolean() }))
  .action(async ({ parsedInput: { enable } }) => {
    if (enable) {
      await sshService.enableSsh()
    } else {
      await sshService.disableSsh()
    }
    return { success: true }
  })

export const changeSystemPasswordAction = authActionClient
  .schema(changeSystemPasswordSchema)
  .action(async ({ parsedInput: { username, newPassword } }) => {
    await sshService.changeSystemPassword(username, newPassword)
    return { success: true }
  })
