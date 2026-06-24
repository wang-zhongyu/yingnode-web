"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { changePasswordSchema, type ChangePasswordInput } from "@/features/auth/schemas/auth.schema"
import { changePasswordAction } from "@/actions/auth.actions"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  const { execute, isPending } = useAction(changePasswordAction, {
    onSuccess() {
      toast.success("密码修改成功")
      reset()
    },
    onError({ error }) {
      toast.error(error.serverError ?? "密码修改失败")
    },
  })

  return (
    <form id="change-password-form" onSubmit={handleSubmit(execute)}>
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>更新您的登录密码</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel>当前密码</FieldLabel>
            <Input
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
            <FieldError errors={errors.currentPassword ? [errors.currentPassword] : undefined} />
          </Field>
          <Field>
            <FieldLabel>新密码</FieldLabel>
            <Input
              type="password"
              placeholder="至少 8 位"
              autoComplete="new-password"
              {...register("newPassword")}
            />
            <FieldError errors={errors.newPassword ? [errors.newPassword] : undefined} />
          </Field>
          <Field>
            <FieldLabel>确认新密码</FieldLabel>
            <Input
              type="password"
              placeholder="再次输入新密码"
              autoComplete="new-password"
              {...register("confirmNewPassword")}
            />
            <FieldError
              errors={errors.confirmNewPassword ? [errors.confirmNewPassword] : undefined}
            />
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            修改密码
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
