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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { toast } from "sonner"

export function ManualAddDialog() {
  const { type, isOpen, close, data } = useModalStore()
  const [ssid, setSSID] = useState(data.ssid ?? "")
  const [password, setPassword] = useState("")
  const [security, setSecurity] = useState("WPA2")
  const [connecting, setConnecting] = useState(false)

  if (type !== "manualAddNetwork") return null

  async function handleConnect() {
    const trimmedSSID = ssid.trim()
    if (!trimmedSSID) return

    setConnecting(true)
    try {
      const res = await fetch("/api/network/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: trimmedSSID, password, security }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? "连接失败")
        return
      }
      toast.success(`已连接到 "${trimmedSSID}"`)
      close()
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
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-ssid" className="text-sm font-medium">
              网络名称 (SSID)
            </label>
            <Input
              id="manual-ssid"
              value={ssid}
              onChange={(e) => setSSID(e.target.value)}
              placeholder="输入 Wi-Fi 名称"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-security" className="text-sm font-medium">
              安全类型
            </label>
            <Select value={security} onValueChange={(v) => setSecurity(v ?? "WPA2")}>
              <SelectTrigger id="manual-security">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WPA2">WPA2</SelectItem>
                <SelectItem value="WPA">WPA</SelectItem>
                <SelectItem value="WEP">WEP</SelectItem>
                <SelectItem value="OPEN">开放网络</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-password" className="text-sm font-medium">
              密码
            </label>
            <Input
              id="manual-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码（开放网络留空）"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            取消
          </Button>
          <Button onClick={handleConnect} disabled={!ssid.trim() || connecting}>
            {connecting ? "连接中..." : "连接"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
