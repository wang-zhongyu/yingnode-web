"use client"

import { useModalStore, type ModalType } from "@/shared/stores/use-modal-store"

export function ModalProvider() {
  const { type, isOpen } = useModalStore()

  if (!isOpen || !type) return null

  const modalMap: Partial<Record<ModalType, React.ReactNode>> = {
    manualAddNetwork: null,
    networkSettings: null,
  }

  return <>{modalMap[type]}</>
}
