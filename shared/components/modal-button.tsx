"use client"

import { Button } from "@/components/ui/button"
import { useModalStore, type ModalType, type ModalData } from "@/shared/stores/use-modal-store"
import type { LucideIcon } from "lucide-react"

interface ModalButtonProps {
  modalType: ModalType
  modalData?: ModalData
  label: string
  icon: LucideIcon
  variant?: "ghost" | "outline" | "default"
  size?: "default" | "sm" | "icon"
  className?: string
}

export function ModalButton({
  modalType,
  modalData,
  label,
  icon: Icon,
  variant = "ghost",
  size = "default",
  className,
}: ModalButtonProps) {
  const open = useModalStore((s) => s.open)

  return (
    <Button variant={variant} size={size} onClick={() => open(modalType, modalData)} className={className}>
      <Icon className="size-4" data-icon="inline-start" />
      {label}
    </Button>
  )
}
