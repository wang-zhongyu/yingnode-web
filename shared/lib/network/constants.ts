import type { DeviceConfig } from "@/shared/types/network"

// Connectivity check targets — use DNS servers reachable from both China and global networks
export const PING_TARGETS = ["223.5.5.5", "114.114.114.114", "8.8.8.8"]

// Standalone wpa_supplicant control socket — we manage this ourselves so NM
// doesn't interfere with the socket lifecycle during connection attempts
export const WPA_SOCKET_DIR = "/tmp/wpa-yingnode"
export const WPA_SOCKET_CLI = `-p ${WPA_SOCKET_DIR}`
export const WPA_CONFIG = "/tmp/wpa-yingnode.conf"

/** Escape a string for safe use in a RegExp literal. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Shared mutable state that the NetworkService facade exposes to extracted
 *  module functions. Functions read/write these fields via the interface so
 *  the facade class remains the single owner of the actual state. */
export interface NetworkServiceState {
  getConfig(): Promise<DeviceConfig>
  clearConfigCache(): void
  staticIpEnsured: boolean
  startingHotspot: boolean
  lastHotspotFailure: number
  lastHotspotError: string | null
}
