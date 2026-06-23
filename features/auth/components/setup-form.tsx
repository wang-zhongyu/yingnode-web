"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setupSchema, type SetupInput } from "@/features/auth/schemas/auth.schema"
import { setupAdminAction } from "@/actions/auth.actions"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function SetupForm() {
  const router = useRouter()
  const { execute, isPending } = useAction(setupAdminAction, {
    onSuccess() {
      toast.success("管理员账户创建成功，请登录")
      router.push("/login")
    },
    onError({ error }) {
      toast.error(error.serverError ?? "创建失败")
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>初始化设置</CardTitle>
        <CardDescription>创建管理员账户以开始使用 YingNode</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="setup-form"
          onSubmit={handleSubmit(execute)}
          className="flex flex-col gap-4"
        >
          <Field>
            <FieldLabel>邮箱</FieldLabel>
            <Input
              type="email"
              placeholder="admin@example.com"
              autoComplete="email"
              {...register("email")}
            />
            <FieldError errors={errors.email ? [errors.email] : undefined} />
          </Field>
          <Field>
            <FieldLabel>密码</FieldLabel>
            <Input
              type="password"
              placeholder="至少 8 位"
              autoComplete="new-password"
              {...register("password")}
            />
            <FieldError errors={errors.password ? [errors.password] : undefined} />
          </Field>
          <Field>
            <FieldLabel>确认密码</FieldLabel>
            <Input
              type="password"
              placeholder="再次输入密码"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            <FieldError
              errors={errors.confirmPassword ? [errors.confirmPassword] : undefined}
            />
          </Field>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="setup-form" className="w-full" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          创建管理员账户
        </Button>
      </CardFooter>
    </Card>
  )
}
