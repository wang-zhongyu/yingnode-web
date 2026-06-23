import { NetworkManagerButton } from "@/features/network/components/network-manager-button"

export default function NetworkPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">网络管理</h1>
        <NetworkManagerButton />
      </div>
      <p className="text-sm text-muted-foreground">
        点击菜单栏按钮扫描周边 Wi-Fi 并连接。设备断网时将自动开启热点。
      </p>
    </div>
  )
}
