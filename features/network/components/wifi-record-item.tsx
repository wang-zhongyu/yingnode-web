"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Wifi, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { WiFiRecordItem as WiFiRecordItemType } from "@/shared/types/network"

interface WiFiRecordItemProps {
  record: WiFiRecordItemType
  onDeleted: () => void
}

export function WiFiRecordItem({ record, onDeleted }: WiFiRecordItemProps) {
  const [deleting, setDeleting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await fetch(`/api/network/wifi-records/${record.id}`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "连接失败")
        return
      }
      if (data.ipAddress) {
        toast.success(`已连接到 "${data.ssid}"`, {
          description: `IP: ${data.ipAddress}`,
        })
      } else {
        toast.success(`已连接到 "${data.ssid}"`)
      }
    } catch {
      toast.error("连接失败")
    } finally {
      setConnecting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/network/wifi-records/${record.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "删除失败")
        return
      }
      toast.success(`已忘记 "${record.ssid}"`)
      onDeleted()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const addedDate = new Date(record.addedAt).toLocaleDateString("zh-CN")

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium truncate">{record.ssid}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {record.security}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">{addedDate}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleConnect}
          disabled={connecting || record.networkId == null}
          title={record.networkId == null ? "需要重新输入密码" : "连接"}
        >
          <Wifi className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
