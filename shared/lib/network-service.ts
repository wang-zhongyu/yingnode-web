import { getDeviceConfig } from "@/shared/lib/device-config"
import type { NetworkStatus, WiFiNetwork, ConnectResult } from "@/shared/types/network"

import { ensureInterfaceReady, ensureStaticIp, remanageNM, unmanageNM } from "./network/interface"
import { checkConnectivity, isOnline, hasExternalIp, isWiFiAssociated } from "./network/connectivity"
import { getStatus, updateDB } from "./network/db-status"
import { stopHotspot, startHotspotInternal } from "./network/hotspot"
import { scanWiFi, getInterfaceStatuses } from "./network/wifi-scan"
import { getSavedWiFi, forgetWiFi } from "./network/wifi-records"
import { connectWiFi, reconnectViaNetworkId, getReachableIp } from "./network/wifi-connect"

export class NetworkService {
  // Shared state — exposed to extracted modules via NetworkServiceState
  staticIpEnsured = false
  startingHotspot = false
  lastHotspotFailure = 0
  lastHotspotError: string | null = null

  // Private state — owned exclusively by this class
  private configCache: Awaited<ReturnType<typeof getDeviceConfig>> | null = null
  private configCacheTime: number = 0
  private static readonly CONFIG_CACHE_TTL_MS = 30_000 // 30 seconds

  /** Read device config from DB, with env-var fallback. Cached after first read. */
  async getConfig() {
    const now = Date.now()
    if (!this.configCache || now - this.configCacheTime > NetworkService.CONFIG_CACHE_TTL_MS) {
      this.configCache = await getDeviceConfig()
      this.configCacheTime = now
    }
    return this.configCache
  }

  /** Clear cached config so next read pulls fresh values from DB.
   *  Also resets staticIpEnsured so the new IP gets bound on next ensureStaticIp call. */
  clearConfigCache(): void {
    this.configCache = null
    this.configCacheTime = 0
    this.staticIpEnsured = false
  }

  // ── Delegated methods ──────────────────────────────────────────

  async ensureInterfaceReady(opts?: { skipApModeCheck?: boolean }) {
    return ensureInterfaceReady(this, opts)
  }

  async ensureStaticIp(): Promise<void> {
    return ensureStaticIp(this)
  }

  async checkConnectivity(): Promise<boolean> {
    return checkConnectivity()
  }

  async isOnline(): Promise<boolean> {
    return isOnline(this)
  }

  async hasExternalIp(): Promise<boolean> {
    return hasExternalIp(this)
  }

  async getStatus(): Promise<NetworkStatus> {
    return getStatus()
  }

  async updateDB(fields: Record<string, unknown>): Promise<void> {
    return updateDB(fields)
  }

  async remanageNM(): Promise<void> {
    return remanageNM(this)
  }

  async unmanageNM(): Promise<void> {
    return unmanageNM(this)
  }

  async isWiFiAssociated(): Promise<boolean> {
    return isWiFiAssociated(this)
  }

  /** Start hotspot if not already starting. Guards against concurrent starts. */
  async startHotspot(): Promise<void> {
    if (this.startingHotspot) return
    this.startingHotspot = true
    try {
      await startHotspotInternal(this)
    } finally {
      this.startingHotspot = false
    }
  }

  async stopHotspot(): Promise<void> {
    return stopHotspot(this)
  }

  async scanWiFi(): Promise<WiFiNetwork[]> {
    return scanWiFi(this)
  }

  async getInterfaceStatuses() {
    return getInterfaceStatuses(this)
  }

  async getSavedWiFi() {
    return getSavedWiFi(this)
  }

  async forgetWiFi(id: number): Promise<boolean> {
    return forgetWiFi(this, id)
  }

  async getReachableIp(): Promise<string | null> {
    return getReachableIp(this)
  }

  async connectWiFi(ssid: string, password?: string, security?: string): Promise<ConnectResult> {
    return connectWiFi(this, ssid, password, security)
  }

  async reconnectViaNetworkId(_networkId: number, ssid: string): Promise<ConnectResult> {
    return reconnectViaNetworkId(this, _networkId, ssid)
  }
}

export const networkService = new NetworkService()
