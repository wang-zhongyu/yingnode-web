import { execAsync, safeArg } from "@/shared/lib/shell"
import type { WiFiNetwork } from "@/shared/types/network"
import type { NetworkServiceState } from "./constants"

/** Scan using nl80211 `iw` instead of Wireless Extensions `iwlist`.
 *  nl80211 can scan in AP mode on many drivers (including brcmfmac) where
 *  the older iwlist cannot. */
export async function scanWiFi(state: NetworkServiceState): Promise<WiFiNetwork[]> {
  const { wifiInterface } = await state.getConfig()
  try {
    // iw dev <iface> scan triggers a scan and blocks until results are ready (~3-5s)
    const { stdout } = await execAsync(`sudo iw dev ${safeArg(wifiInterface)} scan`, 12000)
    const networks = parseIwScan(stdout)
    if (networks.length > 0) return networks
  } catch {
    // iw scan failed — try iwlist as fallback
  }

  // Fallback: iwlist (Wireless Extensions) — works in managed mode
  try {
    const { stdout } = await execAsync(`sudo iwlist ${safeArg(wifiInterface)} scan`, 10000)
    const networks = parseIwlist(stdout)
    if (networks.length > 0) return networks
  } catch {
    // both methods failed
  }

  return []
}

/** Parse `iw dev <iface> scan` output into WiFiNetwork array. */
export function parseIwScan(output: string): WiFiNetwork[] {
  const cells = output.split(/^BSS /m).slice(1)
  const networks: WiFiNetwork[] = []

  for (const cell of cells) {
    const ssidMatch = cell.match(/^SSID:\s*(.+?)\s*$/m)
    if (!ssidMatch) continue
    const ssid = ssidMatch[1].trim()
    if (!ssid || ssid === "\\x00") continue

    const signalMatch = cell.match(/^signal:\s*(-?\d+(?:\.\d+)?)\s*dBm/m)
    const freqMatch = cell.match(/^freq:\s*(\d+)/m)
    const hasRsn = /^RSN:/m.test(cell)
    const hasWpa = /^WPA:/m.test(cell)

    networks.push({
      ssid,
      signal: signalMatch ? Math.round(parseFloat(signalMatch[1])) : -100,
      security: hasRsn || hasWpa ? "WPA2" : "OPEN",
      connected: false,
      frequency: freqMatch ? parseFloat(freqMatch[1]) / 1000 : undefined,
    })
  }

  return networks.sort((a, b) => b.signal - a.signal)
}

/** Parse legacy `iwlist <iface> scan` output (fallback). */
export function parseIwlist(output: string): WiFiNetwork[] {
  const cells = output.split(/Cell \d+ - Address: /).slice(1)
  const networks: WiFiNetwork[] = []

  for (const cell of cells) {
    const ssidMatch = cell.match(/ESSID:"(.+?)"/)
    const signalMatch = cell.match(/Signal level=(-?\d+)/)
    const encMatch = cell.match(/Encryption key:(on|off)/)

    if (!ssidMatch) continue
    const ssid = ssidMatch[1]
    if (!ssid || ssid === "\\x00") continue

    const freqMatch = cell.match(/Frequency:(\d+\.?\d*)\s*GHz/)
    networks.push({
      ssid,
      signal: signalMatch ? parseInt(signalMatch[1]) : -100,
      security: encMatch && encMatch[1] === "on" ? "WPA2" : "OPEN",
      connected: false,
      frequency: freqMatch ? parseFloat(freqMatch[1]) : undefined,
    })
  }

  return networks.sort((a, b) => b.signal - a.signal)
}

/** List physical network interfaces with their operstate and IPv4 addresses.
 *  Filters out loopback. Non-hotspot IPs are listed first. */
export async function getInterfaceStatuses(
  state: NetworkServiceState,
): Promise<Array<{ name: string; state: "UP" | "DOWN" | "UNKNOWN"; ipv4s: string[] }>> {
  try {
    const { hotspotIp } = await state.getConfig()
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
    const ipMap = new Map<string, string[]>()
    for (const line of addrOut.split("\n")) {
      const m = line.match(/^\d+:\s+(\S+)\s+inet\s+([\d.]+)/)
      if (!m) continue
      const iface = m[1].includes("@") ? m[1].split("@")[0] : m[1]
      const existing = ipMap.get(iface) ?? []
      existing.push(m[2])
      ipMap.set(iface, existing)
    }

    const result: Array<{
      name: string
      state: "UP" | "DOWN" | "UNKNOWN"
      ipv4s: string[]
    }> = []
    for (const [name, state] of stateMap) {
      if (name === "lo") continue
      const ips = ipMap.get(name) ?? []
      // Sort: non-hotspot IPs first, hotspot IP last
      ips.sort((a, b) => {
        if (a === hotspotIp) return 1
        if (b === hotspotIp) return -1
        return 0
      })
      result.push({ name, state: state as "UP" | "DOWN" | "UNKNOWN", ipv4s: ips })
    }

    return result
  } catch {
    return []
  }
}
