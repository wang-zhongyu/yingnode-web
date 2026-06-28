"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setupSchema, type SetupInput } from "@/features/auth/schemas/auth.schema"
import { setupAdminAction } from "@/actions/auth.actions"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
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

  const form = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(execute)}>
        <Card>
          <CardHeader>
            <CardTitle>初始化设置</CardTitle>
            <CardDescription>创建管理员账户以开始使用 YingNode</CardDescription>
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
                      placeholder="至少 8 位"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认密码</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="再次输入密码"
                      autoComplete="new-password"
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
              创建管理员账户
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
