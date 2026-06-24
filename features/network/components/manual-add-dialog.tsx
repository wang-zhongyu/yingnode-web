"use client"

import { useState } from "react"
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
import { toast } from "sonner"

export function ManualAddDialog() {
  const { type, isOpen, close, data } = useModalStore()
  const [connecting, setConnecting] = useState(false)
  const router = useRouter()

  if (type !== "manualAddNetwork") return null

  async function handleConnect(ssid: string, password: string, security: string) {
    setConnecting(true)
    try {
      const res = await fetch("/api/network/connect", {
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
      router.refresh()
    } catch {
      toast.error("连接失败")
    } finally {
      setConnecting(false)
    }
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
          connecting={connecting}
          onConnect={handleConnect}
        />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            取消
          </Button>
          <Button form="manual-add-form" type="submit" disabled={connecting}>
            {connecting ? "连接中..." : "连接"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
