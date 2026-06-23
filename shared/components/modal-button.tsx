"use client"

import { Button } from "@/components/ui/button"
import { useModalStore, type ModalType, type ModalData } from "@/shared/stores/use-modal-store"

interface ModalButtonProps {
  modalType: ModalType
  modalData?: ModalData
  children: React.ReactNode
  variant?: Parameters<typeof Button>[0]["variant"]
  className?: string
}

export function ModalButton({ modalType, modalData, children, variant, className }: ModalButtonProps) {
  const open = useModalStore((s) => s.open)

  return (
    <Button variant={variant} className={className} onClick={() => open(modalType, modalData)}>
      {children}
    </Button>
  )
}
