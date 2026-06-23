"use client"

import { Plus } from "lucide-react"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function ManualAddItem() {
  const open = useModalStore((s) => s.open)

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
      onClick={() => open("manualAddNetwork")}
    >
      <Plus className="size-4" />
      <span>手动添加...</span>
    </button>
  )
}
