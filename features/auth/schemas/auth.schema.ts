import { z } from "zod"

export const signInSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码"),
})

export type SignInInput = z.infer<typeof signInSchema>

export const setupSchema = z
  .object({
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(8, "密码至少 8 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  })

export type SetupInput = z.infer<typeof setupSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z.string().min(8, "新密码至少 8 位"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmNewPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
