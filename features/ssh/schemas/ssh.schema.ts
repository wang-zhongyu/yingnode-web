import { z } from "zod"

export const changeSystemPasswordSchema = z
  .object({
    username: z.string().min(1, "请输入用户名"),
    newPassword: z.string().min(1, "请输入新密码"),
    confirmNewPassword: z.string().min(1, "请确认新密码"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "两次密码不一致",
    path: ["confirmNewPassword"],
  })

export type ChangeSystemPasswordInput = z.infer<typeof changeSystemPasswordSchema>
