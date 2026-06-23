"use client"

import { useEffect, useState } from "react"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { Wifi, WifiOff, Radio, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NetworkPopover } from "./network-popover"
import type { NetworkStatus } from "@/shared/types/network"

export function NetworkManagerButton() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/network/status")
        if (!res.ok) return
        const data = await res.json()
        setStatus(data)
      } catch { /* ignore network errors */ }
    }
    poll()
    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [])

  function buttonContent() {
    if (!status) return <Loader2 className="size-4 animate-spin" />

    switch (status.status) {
      case "HOTSPOT_ACTIVE":
        return (
          <>
            <Radio className="size-4 text-amber-500" />
            <span className="text-sm">热点已开启</span>
          </>
        )
      case "OFFLINE":
        return (
          <>
            <WifiOff className="size-4" />
            <span className="text-sm">正在搜索网络...</span>
          </>
        )
      default:
        return (
          <>
            <Wifi className="size-4" />
            <span className="text-sm max-w-32 truncate">
              {status.currentSSID ?? "已连接"}
            </span>
          </>
        )
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {buttonContent()}
        </Button>
      </PopoverTrigger>
      <NetworkPopover />
    </Popover>
  )
}
