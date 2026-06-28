"use client"

import { Settings } from "lucide-react"
import { ModalButton } from "@/shared/components/modal-button"

export function NetworkSettingsEntry() {
  return <ModalButton modalType="networkSettings" label="网络设置..." icon={Settings} className="w-full justify-start" />
}
