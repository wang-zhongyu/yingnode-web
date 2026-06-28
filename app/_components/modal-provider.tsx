"use client"

import { useModalStore, type ModalType } from "@/shared/stores/use-modal-store"
import { ManualAddDialog } from "@/features/network/components/manual-add-dialog"
import { ConnectFromHotspotDialog } from "@/features/network/components/connect-from-hotspot-dialog"
import { NetworkSettingsSheet } from "@/features/network/components/network-settings-sheet"
import { TerminalModal } from "@/features/terminal/components/terminal-modal"

export function ModalProvider() {
  const { type, isOpen } = useModalStore()

  if (!isOpen || !type) return null

  const modalMap: Record<ModalType, React.ReactNode> = {
    manualAddNetwork: <ManualAddDialog key="manualAddNetwork" />,
    connectFromHotspot: <ConnectFromHotspotDialog key="connectFromHotspot" />,
    networkSettings: <NetworkSettingsSheet key="networkSettings" />,
    terminal: <TerminalModal key="terminal" />,
  }

  return <>{modalMap[type]}</>
}
