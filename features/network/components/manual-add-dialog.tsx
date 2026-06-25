"use client"

import { useRouter } from "next/navigation"
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
import { connectWiFiAction } from "@/actions/network.actions"
import { toast } from "sonner"

export function ManualAddDialog() {
  const { type, isOpen, close, data } = useModalStore()
  const router = useRouter()

  const { execute, isPending } = useAction(connectWiFiAction, {
    onSuccess({ data: result }) {
      if (!result) return
      toast.success(`已连接到 "${result.ssid}"`)
      close()
      router.refresh()
    },
    onError({ error }) {
      toast.error(error.serverError ?? "连接失败")
    },
  })

  if (type !== "manualAddNetwork") return null

  function handleConnect(ssid: string, password: string, security: ManualAddInput["security"]) {
    execute({ ssid, password, security })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>手动添加网络</DialogTitle>
          <DialogDescription>输入要连接的 Wi-Fi 网络信息</DialogDescription>
        </DialogHeader>
        <ManualAddFormFields
          initialSSID={data.ssid ?? ""}
          connecting={isPending}
          onConnect={handleConnect}
        />
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isPending}>
            取消
          </Button>
          <Button form="manual-add-form" type="submit" disabled={isPending}>
            {isPending ? "连接中..." : "连接"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
