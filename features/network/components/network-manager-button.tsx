"use client"

import { useEffect, useRef, useState } from "react"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Wifi, WifiOff, Radio, Loader2 } from "lucide-react"
import { NetworkPopover } from "./network-popover"
import type { NetworkStatus } from "@/shared/types/network"

export function NetworkManagerButton() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [error, setError] = useState(false)
  const [ipDialogOpen, setIpDialogOpen] = useState(false)
  const [dialogIp, setDialogIp] = useState("")
  const prevIpRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/network/status")
        if (!res.ok) throw new Error("Failed")
        const data = (await res.json()) as NetworkStatus
        setStatus(data)
        setError(false)

        const currentIp = data.reachableIp ?? data.ipAddress
        if (prevIpRef.current !== undefined && currentIp && currentIp !== prevIpRef.current) {
          setDialogIp(currentIp)
          setIpDialogOpen(true)
        }
        prevIpRef.current = currentIp
      } catch {
        setError(true)
      }
    }
    poll()
    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [])

  const port = typeof window !== "undefined" ? window.location.port : "3000"
  const accessUrl = port ? `http://${dialogIp}:${port}` : `http://${dialogIp}`

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

      <AlertDialog open={ipDialogOpen} onOpenChange={setIpDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>网络地址已变更</AlertDialogTitle>
            <AlertDialogDescription>
              设备 IP 已更新，请在浏览器中访问以下地址：
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 text-center">
            <span className="text-lg font-mono font-semibold tracking-wide select-all">
              {accessUrl}
            </span>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction variant="default">知道了</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
