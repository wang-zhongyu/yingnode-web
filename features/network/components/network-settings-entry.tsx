"use client"

import { Settings } from "lucide-react"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function NetworkSettingsEntry() {
  const open = useModalStore((s) => s.open)

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
      onClick={() => open("networkSettings")}
    >
      <Settings className="size-4" />
      <span>网络设置...</span>
    </button>
  )
}
