"use client"

import { useModalStore, type ModalType } from "@/shared/stores/use-modal-store"
import { ManualAddDialog } from "@/features/network/components/manual-add-dialog"
import { NetworkSettingsSheet } from "@/features/network/components/network-settings-sheet"
import { TerminalSheet } from "@/features/terminal/components/terminal-sheet"

export function ModalProvider() {
  const { type, isOpen } = useModalStore()

  if (!isOpen || !type) return null

  const modalMap: Record<ModalType, React.ReactNode> = {
    manualAddNetwork: <ManualAddDialog key="manualAddNetwork" />,
    networkSettings: <NetworkSettingsSheet key="networkSettings" />,
    terminal: <TerminalSheet key="terminal" />,
  }

  return <>{modalMap[type]}</>
}
