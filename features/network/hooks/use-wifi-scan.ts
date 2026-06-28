"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import type { WiFiNetwork } from "@/shared/types/network"

interface UseWiFiScanResult {
  networks: WiFiNetwork[]
  scanning: boolean
  scan: (currentSSID: string | null) => void
}

export function useWiFiScan(): UseWiFiScanResult {
  const [networks, setNetworks] = useState<WiFiNetwork[]>([])
  const [scanning, setScanning] = useState(false)

  const scan = useCallback(async (currentSSID: string | null) => {
    setScanning(true)
    try {
      const res = await fetch("/api/network/scan")
      if (!res.ok) throw new Error("扫描失败")
      const data = await res.json()
      const result: WiFiNetwork[] = currentSSID
        ? data.networks.map((n: WiFiNetwork) =>
            n.ssid === currentSSID ? { ...n, connected: true } : n,
          )
        : data.networks
      setNetworks(result)
    } catch {
      toast.error("无法扫描网络，请检查无线网卡")
    } finally {
      setScanning(false)
    }
  }, [])

  return { networks, scanning, scan }
}
