"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import {
  changeSystemPasswordSchema,
  type ChangeSystemPasswordInput,
} from "@/features/ssh/schemas/ssh.schema"
import { changeSystemPasswordAction } from "@/actions/ssh.actions"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

export function ChangeSystemPasswordForm() {
  const form = useForm<ChangeSystemPasswordInput>({
    resolver: zodResolver(changeSystemPasswordSchema),
    defaultValues: {
      username: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  })

  const { execute, isPending } = useAction(changeSystemPasswordAction, {
    onSuccess() {
      toast.success("系统密码修改成功")
      form.reset()
    },
    onError({ error }) {
      toast.error(error.serverError ?? "密码修改失败")
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => execute(data))}>
        <Card>
          <CardHeader>
            <CardTitle>修改系统密码</CardTitle>
            <CardDescription>修改 Linux 系统用户登录密码，用于 SSH 等终端登录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="root"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
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
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认新密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              修改密码
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
