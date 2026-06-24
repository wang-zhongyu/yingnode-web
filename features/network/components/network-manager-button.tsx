"use client"

import { useEffect, useRef, useState } from "react"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { Wifi, WifiOff, Radio, Loader2 } from "lucide-react"
import { NetworkPopover } from "./network-popover"
import { IpChangeAlertDialog } from "./ip-change-alert-dialog"
import type { NetworkStatus } from "@/shared/types/network"

export function NetworkManagerButton() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [error, setError] = useState(false)
  const [dialogUrl, setDialogUrl] = useState<string | null>(null)
  const prevIpRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch("/api/network/status")
        if (!res.ok) throw new Error("Failed")
        const data = (await res.json()) as NetworkStatus
        if (cancelled) return
        setStatus(data)
        setError(false)

        const currentIp = data.reachableIp ?? data.ipAddress
        if (prevIpRef.current !== undefined && currentIp && currentIp !== prevIpRef.current) {
          const port = window.location.port
          const url = port ? `http://${currentIp}:${port}` : `http://${currentIp}`
          setDialogUrl(url)
        }
        prevIpRef.current = currentIp
      } catch {
        if (!cancelled) setError(true)
      }
    }
    poll()
    const interval = setInterval(poll, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  function buttonContent() {
    if (error) {
      return (
        <>
          <WifiOff className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">无法获取状态</span>
        </>
      )
    }

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
    <>
      <Popover>
        <PopoverTrigger className="inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm hover:bg-muted">
          {buttonContent()}
        </PopoverTrigger>
        <NetworkPopover />
      </Popover>

      <IpChangeAlertDialog
        open={dialogUrl !== null}
        onOpenChange={(open) => {
          if (!open) setDialogUrl(null)
        }}
        accessUrl={dialogUrl ?? ""}
      />
    </>
  )
}
