"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WiFiNetwork } from "@/shared/types/network"
import { WiFiListItem } from "./wifi-list-item"

interface OtherNetworksSectionProps {
  networks: WiFiNetwork[]
  onConnect: (ssid: string, hasPassword: boolean) => void
}

export function OtherNetworksSection({ networks, onConnect }: OtherNetworksSectionProps) {
  const [open, setOpen] = useState(false)

  if (networks.length === 0) return null

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <span>其他网络...</span>
        <ChevronRight className="ml-auto size-4" />
      </Button>
    )
  }

  return (
    <div className="flex flex-col">
      {networks.map((n) => (
        <WiFiListItem key={n.ssid} network={n} onConnect={onConnect} />
      ))}
    </div>
  )
}
