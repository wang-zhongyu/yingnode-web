import { execAsync, safeArg } from "@/shared/lib/shell"
import { PING_TARGETS } from "./constants"
import type { NetworkServiceState } from "./constants"

/** Try each ping target; succeed if any responds. Avoids false offline
 *  detection when a single target is blocked (e.g. GFW blocks 8.8.8.8). */
export async function checkConnectivity(): Promise<boolean> {
  for (const target of PING_TARGETS) {
    try {
      await execAsync(`ping -c 1 -W 2 ${target}`)
      return true
    } catch {
      // try next target
    }
  }
  return false
}

export async function isOnline(state: NetworkServiceState): Promise<boolean> {
  const pingOk = await checkConnectivity()
  if (pingOk) return true
  // Fallback: check if interface has an external DHCP IP — device may be
  // connected to a network that blocks ICMP or our specific ping targets
  const hasExternal = await hasExternalIp(state)
  return hasExternal
}

/** Check if WiFi has an IP from an external network (not the hotspot IP)
 *  AND is actually associated with an access point.
 *  A stale DHCP IP lingering after disconnection does not count. */
export async function hasExternalIp(state: NetworkServiceState): Promise<boolean> {
  const { wifiInterface, hotspotIp } = await state.getConfig()
  try {
    // First verify the WiFi is actually associated with an AP.
    // A lingering DHCP IP from a dropped connection must not fool us.
    const { stdout: linkOut } = await execAsync(
      `iw dev ${safeArg(wifiInterface)} link`,
      3000,
    )
    if (linkOut.includes("Not connected")) return false

    const { stdout } = await execAsync(`ip -4 addr show dev ${safeArg(wifiInterface)}`)
    // Look for any IPv4 that is NOT the hotspot IP (172.16.42.1)
    const matches = [...stdout.matchAll(/inet (\d+\.\d+\.\d+\.\d+)\/\d+/g)]
    return matches.some((m) => m[1] !== hotspotIp)
  } catch {
    return false
  }
}

/** Check if WiFi interface is associated with an access point.
 *  This is the single source of truth for "connected to WiFi". */
export async function isWiFiAssociated(state: NetworkServiceState): Promise<boolean> {
  const { wifiInterface } = await state.getConfig()
  try {
    const { stdout } = await execAsync(
      `iw dev ${safeArg(wifiInterface)} link`,
      3000,
    )
    return !stdout.includes("Not connected")
  } catch {
    return false
  }
}
