import { Wifi, WifiOff, Radio } from "lucide-react"
import type { NetworkStatusType } from "@/shared/types/network"

interface CurrentStatusProps {
  status: NetworkStatusType
  currentSSID: string | null
  hotspotActive: boolean
  reachableIp: string | null
}

export function CurrentStatus({
  status,
  currentSSID,
  hotspotActive,
  reachableIp,
}: CurrentStatusProps) {
  const appUrl = reachableIp ? `http://${reachableIp}:3000` : null
  const accessText = appUrl ? `访问 ${appUrl}` : `IP: ${reachableIp}`

  if (status === "HOTSPOT_ACTIVE") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Radio className="size-4 text-amber-500" />
        <div>
          <p className="text-sm font-medium">热点已开启</p>
          <p className="text-xs text-muted-foreground">
            广播 SSID: yingnode · {accessText}
          </p>
        </div>
      </div>
    )
  }

  if (status === "OFFLINE") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <WifiOff className="size-4" />
        <div>
          <p className="text-sm font-medium">正在搜索网络...</p>
          <p className="text-xs text-muted-foreground">互联网：已断开</p>
        </div>
      </div>
    )
  }

  const connectedSSID = currentSSID ?? "已连接"
  const onlineAccessText = appUrl ? ` · 访问 ${appUrl}` : ""

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Wifi className="size-4 text-emerald-500" />
      <div>
        <p className="text-sm font-medium">已连接 &quot;{connectedSSID}&quot;</p>
        <p className="text-xs text-muted-foreground">
          互联网：已连接{onlineAccessText}
        </p>
      </div>
    </div>
  )
}
