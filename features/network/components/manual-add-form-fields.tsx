"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface ManualAddFormFieldsProps {
  initialSSID: string
  connecting: boolean
  onConnect: (ssid: string, password: string, security: string) => void
}

export function ManualAddFormFields({
  initialSSID,
  connecting,
  onConnect,
}: ManualAddFormFieldsProps) {
  const [ssid, setSSID] = useState(initialSSID)
  const [password, setPassword] = useState("")
  const [security, setSecurity] = useState("WPA2")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedSSID = ssid.trim()
    if (!trimmedSSID) return
    onConnect(trimmedSSID, password, security)
  }

  return (
    <form id="manual-add-form" onSubmit={handleSubmit}>
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
            disabled={connecting}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-security" className="text-sm font-medium">
            安全类型
          </label>
          <Select
            value={security}
            onValueChange={(v) => setSecurity(v ?? "WPA2")}
            disabled={connecting}
          >
            <SelectTrigger id="manual-security">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WPA2">WPA2</SelectItem>
              <SelectItem value="WPA">WPA</SelectItem>
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
            disabled={connecting}
          />
        </div>
      </div>
    </form>
  )
}
