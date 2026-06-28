"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { signIn } from "@/shared/lib/auth-client"
import { signInSchema, type SignInInput } from "@/features/auth/schemas/auth.schema"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function LoginForm() {
  // ponytail: manual isPending — better-auth's signIn.email() is the official
  // client SDK method (not a custom Server Action), so next-safe-action's
  // useAction() does not apply here. Manual state management is the correct
  // pattern per better-auth API.
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const form = useForm<SignInInput>({
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>使用管理员账户登录 YingNode</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="admin@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              登录
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
