"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { WiFiNetwork } from "@/shared/types/network"
import { WiFiListItem } from "./wifi-list-item"

interface OtherNetworksSectionProps {
  networks: WiFiNetwork[]
  onConnect: (ssid: string, hasPassword: boolean) => void
}

export function OtherNetworksSection({ networks, onConnect }: OtherNetworksSectionProps) {
  if (networks.length === 0) return null

  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-accent rounded-md"
        onClick={() => setOpen(true)}
      >
        <span>其他网络...</span>
        <ChevronRight className="ml-auto size-4" />
      </button>
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
