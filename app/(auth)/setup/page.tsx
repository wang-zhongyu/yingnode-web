import { Radio } from "lucide-react"
import { SetupForm } from "@/features/auth/components/setup-form"

export default function SetupPage() {
  return (
    <>
      {/* Branding */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Radio className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">YingNode</h1>
        <p className="text-sm text-muted-foreground">
          可移动便携式 Linux 设备管理
        </p>
      </div>

      {/* Setup form */}
      <div className="w-full max-w-sm">
        <SetupForm />
      </div>
    </>
  )
}
