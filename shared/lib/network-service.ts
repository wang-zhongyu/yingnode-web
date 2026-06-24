import { exec } from "child_process"
import { promisify } from "util"
import { prisma } from "@/shared/lib/prisma"
import { getDeviceConfig } from "@/features/settings/lib/device-config"
import type { NetworkStatus, WiFiNetwork, ConnectResult } from "@/shared/types/network"

const execAsyncBase = promisify(exec)

/** exec with default timeout to prevent hanging on missing commands */
function execAsync(command: string, timeoutMs = 8000) {
  return execAsyncBase(command, { timeout: timeoutMs })
}

const PING_TARGET = "8.8.8.8"
const DNS_TEST_DOMAIN = "google.com"

class NetworkService {
  private staticIpEnsured = false
  private configCache: { wifiInterface: string; hotspotIp: string; hotspotSsid: string } | null = null

  /** Escape a value for safe interpolation inside single-quoted shell strings.
   *  Replaces each ' with '\'' (end quote, escaped quote, resume quote). */
  private escapeShellArg(arg: string): string {
    return arg.replace(/'/g, "'\\''")
  }

  /** Read device config from DB, with env-var fallback. Cached after first read. */
  async getConfig() {
    if (!this.configCache) {
      this.configCache = await getDeviceConfig()
    }
    return this.configCache
  }

  /** Clear cached config so next read pulls fresh values from DB.
   *  Also resets staticIpEnsured so the new IP gets bound on next ensureStaticIp call. */
  clearConfigCache(): void {
    this.configCache = null
    this.staticIpEnsured = false
  }

  /** Ensure the fixed IP is always bound to the interface as secondary.
   *  This means the device is always reachable at 172.16.42.1 whether
   *  in hotspot mode or connected to an external WiFi network. */
  async ensureStaticIp(): Promise<void> {
    // Avoid redundant sudo calls — only add once per process lifetime
    if (this.staticIpEnsured) return

    const { wifiInterface, hotspotIp } = await this.getConfig()

    try {
      // Check if IP already exists on interface
      const { stdout } = await execAsync(`ip -4 addr show dev ${wifiInterface}`)
      if (!stdout.includes(hotspotIp)) {
        await execAsync(`sudo ip addr add ${hotspotIp}/24 dev ${wifiInterface}`)
      }
      this.staticIpEnsured = true
    } catch {
      // Non-fatal — the device can still work, just not on the fixed IP
      console.warn(`[network] Failed to add static IP ${hotspotIp} on ${wifiInterface}`)
    }
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      await execAsync(`ping -c 1 -W 2 ${PING_TARGET}`)
      return true
    } catch {
      return false
    }
  }

  async checkDNS(): Promise<boolean> {
    try {
      await execAsync(`nslookup ${DNS_TEST_DOMAIN} ${PING_TARGET}`)
      return true
    } catch {
      return false
    }
  }

  async isOnline(): Promise<boolean> {
    const pingOk = await this.checkConnectivity()
    if (!pingOk) return false
    const dnsOk = await this.checkDNS()
    return dnsOk
  }

  async getStatus(): Promise<NetworkStatus> {
    const record = await prisma.networkStatus.findFirst({ where: { id: 1 } })
    if (!record) {
      return {
        status: "ONLINE",
        hotspotActive: false,
        lastCheck: new Date().toISOString(),
        currentSSID: null,
        ipAddress: null,
        reachableIp: null,
      }
    }
    return {
      status: record.status as NetworkStatus["status"],
      hotspotActive: record.hotspotActive,
      lastCheck: record.lastCheck.toISOString(),
      currentSSID: record.currentSSID,
      ipAddress: record.ipAddress,
      reachableIp: null,
    }
  }

  async updateDB(fields: Record<string, unknown>): Promise<void> {
    await prisma.networkStatus.upsert({
      where: { id: 1 },
      update: { ...fields, lastCheck: new Date() },
      create: { id: 1, ...fields, lastCheck: new Date() },
    })
  }

  async startHotspot(): Promise<void> {
    const existingStatus = await this.getStatus()
    if (existingStatus.hotspotActive) return

    this.staticIpEnsured = false
    await this.ensureStaticIp()

    await execAsync(`sudo hostapd -B /etc/hostapd/hostapd.conf`)
    await execAsync(`sudo dnsmasq -C /etc/dnsmasq.conf`)

    await this.updateDB({ status: "HOTSPOT_ACTIVE", hotspotActive: true })
  }

  async stopHotspot(): Promise<void> {
    const existingStatus = await this.getStatus()
    if (!existingStatus.hotspotActive) return

    try { await execAsync("sudo killall hostapd") } catch { /* not running */ }
    try { await execAsync("sudo killall dnsmasq") } catch { /* not running */ }

    // Keep static IP on interface so the device remains reachable
    this.staticIpEnsured = false
    await this.ensureStaticIp()

    await this.updateDB({ status: "ONLINE", hotspotActive: false })
  }

  async scanWiFi(): Promise<WiFiNetwork[]> {
    const { wifiInterface } = await this.getConfig()
    try {
      const { stdout } = await execAsync(`sudo iwlist ${wifiInterface} scan`, 10000)
      return this.parseIwlist(stdout)
    } catch {
      return []
    }
  }

  private parseIwlist(output: string): WiFiNetwork[] {
    const cells = output.split(/Cell \d+ - Address: /).slice(1)
    const networks: WiFiNetwork[] = []

    for (const cell of cells) {
      const ssidMatch = cell.match(/ESSID:"(.+?)"/)
      const signalMatch = cell.match(/Signal level=(-?\d+)/)
      const encMatch = cell.match(/Encryption key:(on|off)/)

      if (!ssidMatch) continue
      const ssid = ssidMatch[1]
      if (!ssid || ssid === "\\x00") continue

      networks.push({
        ssid,
        signal: signalMatch ? parseInt(signalMatch[1]) : -100,
        security: encMatch && encMatch[1] === "on" ? "WPA2" : "OPEN",
        connected: false,
      })
    }

    return networks.sort((a, b) => b.signal - a.signal)
  }

  /** List physical network interfaces with their operstate and IPv4 address.
   *  Filters out loopback. */
  async getInterfaceStatuses(): Promise<
    Array<{ name: string; state: "UP" | "DOWN" | "UNKNOWN"; ipv4?: string }>
  > {
    try {
      const { stdout: linkOut } = await execAsync("ip -o link show")
      const stateMap = new Map<string, string>()
      for (const line of linkOut.split("\n")) {
        const m = line.match(/^\d+:\s+(\S+):\s+/)
        if (!m) continue
        const iface = m[1].includes("@") ? m[1].split("@")[0] : m[1]
        const stateMatch = line.match(/ state (UP|DOWN|UNKNOWN) /)
        const state = stateMatch ? stateMatch[1] : "UNKNOWN"
        stateMap.set(iface, state)
      }

      const { stdout: addrOut } = await execAsync("ip -o -4 addr show")
      const ipMap = new Map<string, string>()
      for (const line of addrOut.split("\n")) {
        const m = line.match(/^\d+:\s+(\S+)\s+inet\s+([\d.]+)/)
        if (!m) continue
        const iface = m[1].includes("@") ? m[1].split("@")[0] : m[1]
        ipMap.set(iface, m[2])
      }

      const result: Array<{
        name: string
        state: "UP" | "DOWN" | "UNKNOWN"
        ipv4?: string
      }> = []
      for (const [name, state] of stateMap) {
        if (name === "lo") continue
        result.push({
          name,
          state: state as "UP" | "DOWN" | "UNKNOWN",
          ipv4: ipMap.get(name),
        })
      }

      return result
    } catch {
      return []
    }
  }

  /** Read all saved WiFi records from the database. */
  async getSavedWiFi(): Promise<
    Array<{
      id: number
      ssid: string
      security: string
      addedAt: string
      lastUsed: string | null
    }>
  > {
    const records = await prisma.wiFiRecord.findMany({
      orderBy: { addedAt: "desc" },
    })
    return records.map((r) => ({
      id: r.id,
      ssid: r.ssid,
      security: r.security,
      addedAt: r.addedAt.toISOString(),
      lastUsed: r.lastUsed?.toISOString() ?? null,
    }))
  }

  /** Find the wpa_cli network ID for a given SSID. Returns null if not found. */
  private async getWpaNetworkId(
    ssid: string,
    iface: string,
  ): Promise<number | null> {
    try {
      const { stdout } = await execAsync(`wpa_cli -i ${iface} list_networks`)
      const lines = stdout.split("\n").slice(1)
      for (const line of lines) {
        const parts = line.split("\t")
        if (parts.length < 2) continue
        const id = parseInt(parts[0], 10)
        const name = parts[1]
        if (!isNaN(id) && name === ssid) return id
      }
      return null
    } catch {
      return null
    }
  }

  /** Remove a saved WiFi network from both wpa_supplicant and the database. */
  async forgetWiFi(id: number, ssid: string): Promise<boolean> {
    const { wifiInterface } = await this.getConfig()

    try {
      const networkId = await this.getWpaNetworkId(ssid, wifiInterface)
      if (networkId !== null) {
        await execAsync(`wpa_cli -i ${wifiInterface} remove_network ${networkId}`)
        await execAsync(`wpa_cli -i ${wifiInterface} save_config`)
      }
    } catch (err) {
      console.warn(`[network] Failed to remove wpa_cli network for "${ssid}":`, err)
    }

    await prisma.wiFiRecord.delete({ where: { id } })
    return true
  }

  /** Get the IP address that other devices on the current network can use to
   *  reach this device. In hotspot mode returns the fixed hotspot IP.
   *  On an external network returns the DHCP-assigned IP. */
  async getReachableIp(): Promise<string | null> {
    const { wifiInterface, hotspotIp } = await this.getConfig()
    const status = await this.getStatus()

    try {
      const { stdout } = await execAsync(`ip -4 addr show dev ${wifiInterface}`)
      const matches = [...stdout.matchAll(/inet (\d+\.\d+\.\d+\.\d+)\/\d+ scope global/g)]
      const ips = matches.map(m => m[1])

      // In hotspot mode: return the fixed IP (clients connect to the AP via this)
      if (status.hotspotActive) {
        return ips.includes(hotspotIp) ? hotspotIp : null
      }

      // In external WiFi mode: return the non-hotspot IP (DHCP or static LAN IP)
      return ips.find(ip => ip !== hotspotIp) ?? null
    } catch {
      return null
    }
  }

  async connectWiFi(ssid: string, password?: string, security?: string): Promise<ConnectResult> {
    const { wifiInterface } = await this.getConfig()
    const escapedSSID = this.escapeShellArg(ssid)

    try {
      // Capture the network ID returned by add_network
      const { stdout: addOut } = await execAsync(
        `wpa_cli -i ${wifiInterface} add_network`,
      )
      const networkId = parseInt(addOut.trim(), 10)
      if (isNaN(networkId)) {
        return { success: false, ssid: null, ipAddress: null, error: "无法创建网络配置" }
      }

      if (password) {
        const escapedPwd = this.escapeShellArg(password)
        await execAsync(
          `wpa_cli -i ${wifiInterface} set_network ${networkId} ssid '"${escapedSSID}"'`,
        )
        await execAsync(
          `wpa_cli -i ${wifiInterface} set_network ${networkId} psk '"${escapedPwd}"'`,
        )
      } else {
        await execAsync(
          `wpa_cli -i ${wifiInterface} set_network ${networkId} ssid '"${escapedSSID}"'`,
        )
        await execAsync(
          `wpa_cli -i ${wifiInterface} set_network ${networkId} key_mgmt NONE`,
        )
      }

      await execAsync(`wpa_cli -i ${wifiInterface} enable_network ${networkId}`)
      await execAsync(`wpa_cli -i ${wifiInterface} save_config`)
      await execAsync(`wpa_cli -i ${wifiInterface} reconfigure`)

      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Re-add static IP after DHCP overwrites the interface
      this.staticIpEnsured = false
      await this.ensureStaticIp()

      const { stdout } = await execAsync(`wpa_cli -i ${wifiInterface} status`)
      const ipMatch = stdout.match(/ip_address=(.+)/)
      const ipAddress = ipMatch ? ipMatch[1] : null

      await this.updateDB({ currentSSID: ssid, ipAddress })

      // Track WiFi connection in saved records
      try {
        await prisma.wiFiRecord.upsert({
          where: { ssid },
          update: { lastUsed: new Date() },
          create: { ssid, security: security ?? (password ? "WPA2" : "OPEN") },
        })
      } catch {
        // Non-fatal: WiFiRecord tracking failure should not block connection flow
      }

      return { success: true, ssid, ipAddress }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "连接失败"
      if (msg.includes("WRONG_KEY")) {
        return { success: false, ssid: null, ipAddress: null, error: "密码错误" }
      }
      return { success: false, ssid: null, ipAddress: null, error: "连接超时，请确认密码正确" }
    }
  }
}

export const networkService = new NetworkService()
