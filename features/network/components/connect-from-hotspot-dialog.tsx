"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { ManualAddFormFields } from "./manual-add-form-fields"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

export function ConnectFromHotspotDialog() {
  const { type, isOpen, close } = useModalStore()
  const [connecting, setConnecting] = useState(false)

  if (type !== "connectFromHotspot") return null

  async function handleConnect(ssid: string, password: string, security: string) {
    setConnecting(true)
    try {
      const res = await fetch("/api/network/connect-from-hotspot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid, password, security }),
      })

      const result = await res.json()
      if (!result.success) {
        toast.error(result.error ?? "连接失败")
        return
      }

      toast.success(`已连接到 "${ssid}"`)
      close()
    } catch {
      // The fetch itself failed. This is expected when the server kills
      // hostapd mid-request: the client loses its connection to the server.
      toast.error("请求中断", {
        description:
          "热点已关闭，与服务器的连接已断开。如果连接未成功，热点将自动恢复，请重新连接热点后检查网络状态。",
      })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>从热点模式连接外部 Wi-Fi</DialogTitle>
          <DialogDescription>
            连接时热点将暂时关闭，设备将尝试连接到您指定的外部网络。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            连接时热点将暂时关闭，您将断开与当前热点的连接。如果连接失败，热点将自动恢复。
          </p>
        </div>

        <ManualAddFormFields
          initialSSID=""
          connecting={connecting}
          onConnect={handleConnect}
        />

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={connecting}>
            取消
          </Button>
          <Button form="manual-add-form" type="submit" disabled={connecting}>
            {connecting ? "连接中..." : "连接并关闭热点"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
