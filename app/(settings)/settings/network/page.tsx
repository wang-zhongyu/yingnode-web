import { InterfaceStatusCard } from "@/features/network/components/interface-status-card"
import { WiFiRecordsCard } from "@/features/network/components/wifi-records-card"
import { networkService } from "@/shared/lib/network-service"

export default async function NetworkSettingsPage() {
  const records = await networkService.getSavedWiFi()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">网络设置</h1>
      <InterfaceStatusCard />
      <WiFiRecordsCard initialRecords={records} />
    </div>
  )
}
