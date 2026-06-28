import { execAsync, safeArg } from "@/shared/lib/shell"
import type { WiFiNetwork } from "@/shared/types/network"
import type { NetworkServiceState } from "./constants"

export async function scanWiFi(state: NetworkServiceState): Promise<WiFiNetwork[]> {
  const { wifiInterface } = await state.getConfig()
  try {
    const { stdout } = await execAsync(`sudo iwlist ${safeArg(wifiInterface)} scan`, 10000)
    return parseIwlist(stdout)
  } catch {
    return []
  }
}

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
