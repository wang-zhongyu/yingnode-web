"use client"

import { Separator } from "@/components/ui/separator"
import type { WiFiNetwork } from "@/shared/types/network"
import { WiFiListItem } from "./wifi-list-item"
import { OtherNetworksSection } from "./other-networks-section"

interface WiFiListProps {
  networks: WiFiNetwork[]
  onConnect: (ssid: string, hasPassword: boolean) => void
}

export function WiFiList({ networks, onConnect }: WiFiListProps) {
  const strongSignal = networks.filter((n) => n.signal > -70)
  const weakSignal = networks.filter((n) => n.signal <= -70)

  return (
    <div className="flex flex-col">
      {strongSignal.map((n) => (
        <WiFiListItem key={n.ssid} network={n} onConnect={onConnect} />
      ))}
      {weakSignal.length > 0 && (
        <>
          <Separator className="my-1" />
          <OtherNetworksSection networks={weakSignal} onConnect={onConnect} />
        </>
      )}
    </div>
  )
}
