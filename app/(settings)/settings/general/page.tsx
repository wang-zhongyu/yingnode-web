import { getDeviceConfig } from "@/shared/lib/device-config"
import { DeviceConfigForm } from "@/features/settings/components/device-config-form"
import { UpdatePanel } from "@/features/settings/components/update-panel"

export default async function GeneralSettingsPage() {
  const config = await getDeviceConfig()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">通用设置</h1>
      <DeviceConfigForm config={config} />
      <UpdatePanel />
    </div>
  )
}
