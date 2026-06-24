import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ChangePasswordForm } from "@/features/auth/components/change-password-form"

export default function AccountSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">账号设置</h1>
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>更新您的登录密码</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
