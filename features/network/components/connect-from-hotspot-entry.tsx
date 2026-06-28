"use client"

import { Wifi } from "lucide-react"
import { ModalButton } from "@/shared/components/modal-button"

export function ConnectFromHotspotEntry() {
  return <ModalButton modalType="connectFromHotspot" label="连接外部 Wi-Fi..." icon={Wifi} className="w-full justify-start" />
}
