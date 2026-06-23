"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { useModalStore } from "@/shared/stores/use-modal-store"
import type { NetworkStatus } from "@/shared/types/network"

export function NetworkSettingsSheet() {
  const { type, isOpen, close } = useModalStore()
  const [status, setStatus] = useState<NetworkStatus | null>(null)

  if (type !== "networkSettings") return null

  useEffect(() => {
    if (!isOpen) return
    fetch("/api/network/status")
      .then((r) => r.json())
      .then(setStatus)
  }, [isOpen])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>网络设置</SheetTitle>
          <SheetDescription>当前网络配置信息</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 mt-4">
          <InfoRow
            label="状态"
            value={
              status?.status === "ONLINE"
                ? "已连接互联网"
                : status?.status === "HOTSPOT_ACTIVE"
                  ? "热点模式"
                  : "离线"
            }
          />
          <InfoRow label="IP 地址" value={status?.ipAddress ?? "—"} />
          <InfoRow label="当前 SSID" value={status?.currentSSID ?? "—"} />
          <Separator />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">热点信息</p>
            <InfoRow label="SSID" value="yingnode" />
            <InfoRow label="IP" value="172.16.42.1" />
            <p className="text-xs text-muted-foreground">
              断网时自动开启，连接后关闭
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  )
}
