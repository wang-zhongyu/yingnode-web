"use client"

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
import type { ManualAddInput } from "../schemas/network.schema"
import { useAction } from "next-safe-action/hooks"
import { connectFromHotspotAction } from "@/actions/network.actions"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

export function ConnectFromHotspotDialog() {
  const { type, isOpen, close } = useModalStore()

  const { execute, isPending } = useAction(connectFromHotspotAction, {
    onSuccess({ data }) {
      if (!data) return
      const extra = data as unknown as Record<string, unknown>
      const ip = (extra.reachableIp as string | undefined) ?? data.ipAddress
      if (ip) {
        toast.success(`已连接到 "${data.ssid}"`, {
          description: `新访问地址: http://${ip}:3000`,
          duration: 10_000,
          action: {
            label: "复制",
            onClick: () => navigator.clipboard.writeText(`http://${ip}:3000`),
          },
        })
      } else {
        toast.success(`已连接到 "${data.ssid}"`)
      }
      close()
    },
    onError({ error }) {
      console.error("[connectFromHotspot] error:", error)
      toast.error(error.serverError || error.validationErrors?._errors?.[0] || "连接失败，请重试")
    },
  })

  if (type !== "connectFromHotspot") return null

  function handleConnect(ssid: string, password: string, security: ManualAddInput["security"]) {
    execute({ ssid, password, security })
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
          connecting={isPending}
          onConnect={handleConnect}
        />

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isPending}>
            取消
          </Button>
          <Button form="manual-add-form" type="submit" disabled={isPending}>
            {isPending ? "连接中..." : "连接并关闭热点"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
