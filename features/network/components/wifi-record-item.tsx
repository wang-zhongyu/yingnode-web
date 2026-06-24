"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { WiFiRecordItem as WiFiRecordItemType } from "@/shared/types/network"

interface WiFiRecordItemProps {
  record: WiFiRecordItemType
  onDeleted: () => void
}

export function WiFiRecordItem({ record, onDeleted }: WiFiRecordItemProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/network/wifi-records/${record.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: record.ssid }),
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
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground">{addedDate}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
