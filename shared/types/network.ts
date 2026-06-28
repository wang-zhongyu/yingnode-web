export type NetworkStatusType = "ONLINE" | "OFFLINE" | "HOTSPOT_ACTIVE"

export interface NetworkStatus {
  status: NetworkStatusType
  hotspotActive: boolean
  lastCheck: string
  currentSSID: string | null
  ipAddress: string | null
  reachableIp: string | null
  hotspotSsid?: string
  hotspotIp?: string
  wifiInterface?: string
  hotspotError?: string | null
}

export interface WiFiNetwork {
  ssid: string
  signal: number
  security: string
  connected: boolean
  frequency?: number
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

export interface InterfaceStatus {
  name: string
  state: "UP" | "DOWN" | "UNKNOWN"
  ipv4s: string[]
}

export interface WiFiRecordItem {
  id: number
  ssid: string
  security: string
  networkId: number | null
  addedAt: string
  lastUsed: string | null
}

export interface DeviceConfig {
  wifiInterface: string
  hotspotIp: string
  hotspotSsid: string
  hotspotPassword: string
}
