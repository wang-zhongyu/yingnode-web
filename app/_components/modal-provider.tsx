"use client"

import { ManualAddDialog } from "@/features/network/components/manual-add-dialog"
import { ConnectFromHotspotDialog } from "@/features/network/components/connect-from-hotspot-dialog"
import { NetworkSettingsSheet } from "@/features/network/components/network-settings-sheet"
import { TerminalModal } from "@/features/terminal/components/terminal-modal"

export function ModalProvider() {
  return (
    <>
      <ManualAddDialog />
      <ConnectFromHotspotDialog />
      <NetworkSettingsSheet />
      <TerminalModal />
    </>
  )
}
