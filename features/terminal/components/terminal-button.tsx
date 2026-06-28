"use client"

import { Terminal } from "lucide-react"
import { ModalButton } from "@/shared/components/modal-button"

export function TerminalButton() {
  return <ModalButton modalType="terminal" label="" icon={Terminal} variant="ghost" size="icon" />
}
