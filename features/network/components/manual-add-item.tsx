"use client"

import { Plus } from "lucide-react"
import { ModalButton } from "@/shared/components/modal-button"

export function ManualAddItem() {
  return <ModalButton modalType="manualAddNetwork" label="手动添加..." icon={Plus} className="w-full justify-start" />
}
