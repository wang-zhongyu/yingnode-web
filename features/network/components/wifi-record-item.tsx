"use client"

import { useState } from "react"
import { useAction } from "next-safe-action/hooks"
import { Button } from "@/components/ui/button"
import { Wifi, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { reconnectWiFiAction, forgetWiFiAction } from "@/actions/network.actions"
import { AlertDialogRoot } from "@/shared/components/alert-dialog-root"
import type { WiFiRecordItem as WiFiRecordItemType } from "@/shared/types/network"

interface WiFiRecordItemProps {
  record: WiFiRecordItemType
  onDeleted: () => void
}

export function WiFiRecordItem({ record, onDeleted }: WiFiRecordItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { execute: reconnect, isPending: reconnecting } = useAction(reconnectWiFiAction, {
    onSuccess({ data }) {
      if (data && data.ipAddress) {
        toast.success(`已连接到 "${data.ssid}"`, {
          description: `IP: ${data.ipAddress}`,
        })
      } else if (data && data.ssid) {
        toast.success(`已连接到 "${data.ssid}"`)
      } else {
        toast.success("连接成功")
      }
    },
    onError({ error }) {
      toast.error(error.serverError ?? "连接失败")
    },
  })

  const { execute: forget, isPending: deleting } = useAction(forgetWiFiAction, {
    onSuccess() {
      toast.success(`已忘记 "${record.ssid}"`)
      onDeleted()
    },
    onError({ error }) {
      toast.error(error.serverError ?? "删除失败")
    },
  })

  function handleConnect() {
    reconnect({ id: record.id })
  }

  function handleDelete() {
    forget({ id: record.id })
  }

  const addedDate = new Date(record.addedAt).toLocaleDateString("zh-CN")

  return (
    <>
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
            disabled={reconnecting || record.networkId == null}
            title={record.networkId == null ? "需要重新输入密码" : "连接"}
          >
            <Wifi className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <AlertDialogRoot
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`忘记 "${record.ssid}"？`}
        description="此网络将从已保存列表中移除。如需重新连接，需要重新输入密码。"
        confirmLabel="忘记"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
