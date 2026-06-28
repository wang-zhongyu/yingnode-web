"use client"

import { useEffect } from "react"
import { PopoverContent } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useAction } from "next-safe-action/hooks"
import { SpinnerEmpty } from "@/shared/components/spinner-empty"
import { ListEmpty } from "@/shared/components/list-empty"
import type { NetworkStatus } from "@/shared/types/network"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { usePolling } from "@/shared/hooks/use-polling"
import { useWiFiScan } from "@/features/network/hooks/use-wifi-scan"
import { connectWiFiAction } from "@/actions/network.actions"
import { CurrentStatus } from "./current-status"
import { WiFiList } from "./wifi-list"
import { ManualAddItem } from "./manual-add-item"
import { NetworkSettingsEntry } from "./network-settings-entry"
import { ConnectFromHotspotEntry } from "./connect-from-hotspot-entry"

export function NetworkPopover() {
  const { data: status, error: statusError, isLoading } = usePolling<NetworkStatus>(
    "/api/network/status",
    0,
  )
  const { networks, scanning, scan } = useWiFiScan()
  const openModal = useModalStore((s) => s.open)
  const { execute } = useAction(connectWiFiAction, {
    onSuccess({ data }) {
      // ponytail: show new IP when connecting from hotspot (reachableIp only set there)
      const extra = data as unknown as Record<string, unknown> | null
      const reachableIp = extra?.reachableIp as string | undefined
      if (reachableIp) {
        toast.success("已连接，请使用新地址访问", {
          description: `http://${reachableIp}:3000`,
          duration: 10_000,
          action: {
            label: "复制",
            onClick: () => navigator.clipboard.writeText(`http://${reachableIp}:3000`),
          },
        })
      }
    },
    onError({ error }) {
      console.error("[popover] connectWiFi error:", error)
      toast.error(error.serverError || error.validationErrors?._errors?.[0] || "连接失败")
    },
  })

  useEffect(() => {
    scan(status?.currentSSID ?? null)
  }, [status, scan])

  async function handleConnect(ssid: string, hasPassword: boolean) {
    if (!hasPassword) {
      execute({ ssid, password: "", security: "OPEN" })
      return
    }

    openModal("manualAddNetwork", { ssid })
  }

  function renderNetworkList() {
    if (scanning) return <SpinnerEmpty message="正在扫描网络..." />
    if (networks.length === 0) {
      const message = effectiveStatus.hotspotActive
        ? "热点模式下无法扫描网络"
        : "未发现可用网络"
      return <ListEmpty message={message} />
    }
    return (
      <>
        <WiFiList networks={networks} onConnect={handleConnect} />
        <Separator />
      </>
    )
  }

  if (isLoading) {
    return (
      <PopoverContent className="w-80 p-0 gap-0">
        <SpinnerEmpty message="加载中..." />
      </PopoverContent>
    )
  }

  const effectiveStatus = status ?? {
    status: "OFFLINE" as const,
    currentSSID: null,
    hotspotActive: false,
  }

  return (
    <PopoverContent className="w-80 p-0 gap-0">
      <CurrentStatus
        status={effectiveStatus.status}
        currentSSID={effectiveStatus.currentSSID}
        hotspotActive={effectiveStatus.hotspotActive}
        reachableIp={status?.reachableIp ?? null}
      />
      <Separator />
      {effectiveStatus.hotspotActive && (
        <>
          <ConnectFromHotspotEntry />
          <Separator />
        </>
      )}
      {renderNetworkList()}
      <ManualAddItem />
      <Separator />
      <NetworkSettingsEntry />
    </PopoverContent>
  )
}
