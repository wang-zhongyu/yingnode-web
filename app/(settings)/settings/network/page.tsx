import { InterfaceStatusCard } from "@/features/network/components/interface-status-card"
import { WiFiRecordsCard } from "@/features/network/components/wifi-records-card"

export default function NetworkSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">网络设置</h1>
      <InterfaceStatusCard />
      <WiFiRecordsCard />
    </div>
  )
}
