import { ChangePasswordForm } from "@/features/auth/components/change-password-form"

export default function AccountSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">账号设置</h1>
      <ChangePasswordForm />
    </div>
  )
}
