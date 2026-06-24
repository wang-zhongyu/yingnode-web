"use client"

import { Button } from "@/components/ui/button"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { TerminalIcon } from "lucide-react"

export function TerminalButton() {
  const openModal = useModalStore((s) => s.open)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => openModal("terminal")}
      title="终端"
    >
      <TerminalIcon className="size-5" />
    </Button>
  )
}
