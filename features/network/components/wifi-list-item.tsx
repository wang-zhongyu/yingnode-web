"use client"

import { Lock, ShieldAlert } from "lucide-react"
import type { WiFiNetwork } from "@/shared/types/network"

interface WiFiListItemProps {
  network: WiFiNetwork
  onConnect: (ssid: string, hasPassword: boolean) => void
}

function signalBars(signal: number): number {
  if (signal > -50) return 4
  if (signal > -60) return 3
  if (signal > -70) return 2
  return 1
}

function securityIcon(security: string) {
  if (security === "OPEN") {
    return <ShieldAlert className="size-3.5 text-muted-foreground" />
  }
  return <Lock className="size-3.5 text-muted-foreground" />
}

export function WiFiListItem({ network, onConnect }: WiFiListItemProps) {
  const bars = signalBars(network.signal)

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
      onClick={() => onConnect(network.ssid, network.security !== "OPEN")}
    >
      <div className="flex items-center gap-2">
        <SignalIcon bars={bars} />
        <span className="text-sm">{network.ssid}</span>
      </div>
      <div className="flex items-center gap-2">
        {securityIcon(network.security)}
        {network.connected && <span className="text-xs text-muted-foreground">✅</span>}
      </div>
    </button>
  )
}

function SignalIcon({ bars }: { bars: number }) {
  return (
    <div className="flex items-end gap-px h-4">
      {[1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className={`w-0.5 rounded-sm ${
            level <= bars ? "bg-foreground" : "bg-muted-foreground/30"
          }`}
          style={{ height: `${level * 4}px` }}
        />
      ))}
    </div>
  )
}
