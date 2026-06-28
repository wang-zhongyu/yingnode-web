import * as sshService from "@/shared/lib/ssh-service"
import { SshToggleCard } from "@/features/ssh/components/ssh-toggle-card"
import { ChangeSystemPasswordForm } from "@/features/ssh/components/change-system-password-form"

export default async function SshSettingsPage() {
  const sshActive = await sshService.isSshActive()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">SSH 设置</h1>
      <SshToggleCard initialActive={sshActive} />
      <ChangeSystemPasswordForm />
    </div>
  )
}
