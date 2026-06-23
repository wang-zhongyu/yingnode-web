import { exec } from "child_process"
import { promisify } from "util"
import { prisma } from "@/shared/lib/prisma"
import type { NetworkStatus, WiFiNetwork, ConnectResult } from "@/shared/types/network"

const execAsyncBase = promisify(exec)

/** exec with default timeout to prevent hanging on missing commands */
function execAsync(command: string, timeoutMs = 8000) {
  return execAsyncBase(command, { timeout: timeoutMs })
}

const WIFI_INTERFACE = process.env.WIFI_INTERFACE ?? "wlan0"
const HOTSPOT_SSID = process.env.HOTSPOT_SSID ?? "yingnode"
const HOTSPOT_IP = process.env.HOTSPOT_IP ?? "172.16.42.1"
const PING_TARGET = "8.8.8.8"
const DNS_TEST_DOMAIN = "google.com"

class NetworkService {
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
      }
    }
    return {
      status: record.status as NetworkStatus["status"],
      hotspotActive: record.hotspotActive,
      lastCheck: record.lastCheck.toISOString(),
      currentSSID: record.currentSSID,
      ipAddress: record.ipAddress,
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

    try {
      await execAsync(`sudo ip addr add ${HOTSPOT_IP}/24 dev ${WIFI_INTERFACE}`)
    } catch { /* IP may already exist */ }

    await execAsync(`sudo hostapd -B /etc/hostapd/hostapd.conf`)
    await execAsync(`sudo dnsmasq -C /etc/dnsmasq.conf`)

    await this.updateDB({ status: "HOTSPOT_ACTIVE", hotspotActive: true })
  }

  async stopHotspot(): Promise<void> {
    const existingStatus = await this.getStatus()
    if (!existingStatus.hotspotActive) return

    try { await execAsync("sudo killall hostapd") } catch { /* not running */ }
    try { await execAsync("sudo killall dnsmasq") } catch { /* not running */ }

    await this.updateDB({ status: "ONLINE", hotspotActive: false })
  }

  async scanWiFi(): Promise<WiFiNetwork[]> {
    try {
      const { stdout } = await execAsync(`sudo iwlist ${WIFI_INTERFACE} scan`, 10000)
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

  async connectWiFi(ssid: string, password?: string): Promise<ConnectResult> {
    try {
      if (password) {
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} add_network`)
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} set_network 0 ssid '"${ssid}"'`)
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} set_network 0 psk '"${password}"'`)
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} enable_network 0`)
      } else {
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} add_network`)
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} set_network 0 ssid '"${ssid}"'`)
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} set_network 0 key_mgmt NONE`)
        await execAsync(`wpa_cli -i ${WIFI_INTERFACE} enable_network 0`)
      }

      await execAsync(`wpa_cli -i ${WIFI_INTERFACE} save_config`)
      await execAsync(`wpa_cli -i ${WIFI_INTERFACE} reconfigure`)

      await new Promise((resolve) => setTimeout(resolve, 5000))

      const { stdout } = await execAsync(`wpa_cli -i ${WIFI_INTERFACE} status`)
      const ipMatch = stdout.match(/ip_address=(.+)/)
      const ipAddress = ipMatch ? ipMatch[1] : null

      await this.updateDB({ currentSSID: ssid, ipAddress })

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
