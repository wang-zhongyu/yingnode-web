export type NetworkStatusType = "ONLINE" | "OFFLINE" | "HOTSPOT_ACTIVE"

export interface NetworkStatus {
  status: NetworkStatusType
  hotspotActive: boolean
  lastCheck: string
  currentSSID: string | null
  ipAddress: string | null
  reachableIp: string | null
}

export interface WiFiNetwork {
  ssid: string
  signal: number
  security: string
  connected: boolean
}

export interface ScanResult {
  networks: WiFiNetwork[]
}

export interface ConnectInput {
  ssid: string
  password?: string
}

export interface ConnectResult {
  success: boolean
  ssid: string | null
  ipAddress: string | null
  error?: string
}
