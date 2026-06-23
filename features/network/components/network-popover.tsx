"use client"

import { useState, useEffect } from "react"
import { PopoverContent } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import type { NetworkStatus, WiFiNetwork } from "@/shared/types/network"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { CurrentStatus } from "./current-status"
import { WiFiList } from "./wifi-list"
import { ManualAddItem } from "./manual-add-item"
import { NetworkSettingsEntry } from "./network-settings-entry"

export function NetworkPopover() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [networks, setNetworks] = useState<WiFiNetwork[]>([])
  const [scanning, setScanning] = useState(false)
  const openModal = useModalStore((s) => s.open)

  useEffect(() => {
    fetchStatus()
    fetchScan()
  }, [])

  async function fetchStatus() {
    const res = await fetch("/api/network/status")
    if (!res.ok) return
    const data = await res.json()
    setStatus(data)
  }

  async function fetchScan() {
    setScanning(true)
    try {
      const res = await fetch("/api/network/scan")
      if (!res.ok) throw new Error("扫描失败")
      const data = await res.json()
      setNetworks(data.networks)
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

  if (!status) {
    return (
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-center py-4">
          <Spinner />
        </div>
      </PopoverContent>
    )
  }

  return (
    <PopoverContent className="w-80 p-0">
      <CurrentStatus
        status={status.status}
        currentSSID={status.currentSSID}
        hotspotActive={status.hotspotActive}
      />
      <Separator />
      {scanning ? (
        <div className="flex items-center justify-center py-4">
          <Spinner />
        </div>
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
