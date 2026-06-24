"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { signIn } from "@/shared/lib/auth-client"
import { signInSchema, type SignInInput } from "@/features/auth/schemas/auth.schema"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function LoginForm() {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  })

  async function onSubmit({ email, password }: SignInInput) {
    setIsPending(true)
    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        toast.error(result.error.message ?? "登录失败，请检查邮箱和密码")
        return
      }

      toast.success("登录成功")
      router.push("/monitoring")
    } catch {
      toast.error("登录失败，请检查邮箱和密码")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录</CardTitle>
        <CardDescription>使用管理员账户登录 YingNode</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="login-form"
          onSubmit={handleSubmit(onSubmit)}
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
              placeholder="请输入密码"
              autoComplete="current-password"
              {...register("password")}
            />
            <FieldError errors={errors.password ? [errors.password] : undefined} />
          </Field>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="login-form" className="w-full" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          登录
        </Button>
      </CardFooter>
    </Card>
  )
}
