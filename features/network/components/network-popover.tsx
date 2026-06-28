"use client"

import { useState, useEffect } from "react"
import { PopoverContent } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { SpinnerEmpty } from "@/shared/components/spinner-empty"
import { ListEmpty } from "@/shared/components/list-empty"
import type { NetworkStatus, WiFiNetwork } from "@/shared/types/network"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { CurrentStatus } from "./current-status"
import { WiFiList } from "./wifi-list"
import { ManualAddItem } from "./manual-add-item"
import { NetworkSettingsEntry } from "./network-settings-entry"
import { ConnectFromHotspotEntry } from "./connect-from-hotspot-entry"

export function NetworkPopover() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [networks, setNetworks] = useState<WiFiNetwork[]>([])
  const [scanning, setScanning] = useState(false)
  const [statusError, setStatusError] = useState(false)
  const openModal = useModalStore((s) => s.open)

  useEffect(() => {
    async function load() {
      const currentSSID = await fetchStatus()
      fetchScan(currentSSID)
    }
    load()
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch("/api/network/status")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setStatus(data)
      setStatusError(false)
      return data.currentSSID as string | null
    } catch {
      setStatusError(true)
      return null
    }
  }

  async function fetchScan(currentSSID: string | null) {
    setScanning(true)
    try {
      const res = await fetch("/api/network/scan")
      if (!res.ok) throw new Error("扫描失败")
      const data = await res.json()
      const networks: WiFiNetwork[] = data.networks
      if (currentSSID) {
        for (const n of networks) {
          if (n.ssid === currentSSID) n.connected = true
        }
      }
      setNetworks(networks)
    } catch {
      toast.error("无法扫描网络，请检查无线网卡")
    } finally {
      setScanning(false)
    }
  }

  async function handleConnect(ssid: string, hasPassword: boolean) {
    if (!hasPassword) {
      const res = await fetch("/api/network/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? "连接失败")
        return
      }
      toast.success(`已连接到 "${ssid}"`)
      fetchStatus()
      return
    }

    openModal("manualAddNetwork", { ssid })
  }

  if (!status && !statusError) {
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
      {scanning ? (
        <SpinnerEmpty message="正在扫描网络..." />
      ) : networks.length === 0 ? (
        <ListEmpty
          message={
            effectiveStatus.hotspotActive
              ? "热点模式下无法扫描网络"
              : "未发现可用网络"
          }
        />
      ) : (
        <>
          <WiFiList networks={networks} onConnect={handleConnect} />
          <Separator />
        </>
      )}
      <ManualAddItem />
      <Separator />
      <NetworkSettingsEntry />
    </PopoverContent>
  )
}
