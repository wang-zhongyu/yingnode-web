import { execAsync, safeArg } from "@/shared/lib/shell"
import { escapeRegex } from "./constants"
import type { NetworkServiceState } from "./constants"

/** Tell NetworkManager to manage or unmanage the WiFi interface. */
export async function toggleNM(managed: boolean, iface: string): Promise<void> {
  const action = managed ? "managed yes" : "managed no"
  try {
    await execAsync("systemctl is-active --quiet NetworkManager")
    await execAsync(
      `sudo nmcli device set ${safeArg(iface)} ${action} 2>/dev/null || true`,
    )
  } catch { /* NetworkManager not running — ok */ }
}

/** Check and correct WiFi interface state before network operations.
 *  1. Bring interface UP if down
 *  2. Switch from Monitor/Master to Managed mode (skip Master when
 *     hotspot is active — switching mode while hostapd runs can kill
 *     the AP on some drivers, and on nl80211 it fails with EBUSY)
 *  Returns false only if the interface is missing entirely. */
export async function ensureInterfaceReady(
  state: NetworkServiceState,
  opts?: { skipApModeCheck?: boolean },
): Promise<{ ok: boolean; reason?: string }> {
  const { wifiInterface } = await state.getConfig()

  // 1. Check interface exists and is UP
  try {
    const { stdout: upOutput } = await execAsync(`ip link show ${safeArg(wifiInterface)}`)
    if (!upOutput.includes(wifiInterface)) {
      return { ok: false, reason: `Interface ${wifiInterface} not found` }
    }
    if (upOutput.includes("state DOWN")) {
      await execAsync(`sudo ip link set ${safeArg(wifiInterface)} up`)
      console.log(`[network] Brought ${wifiInterface} UP`)
    }
  } catch {
    return { ok: false, reason: `Cannot read state of ${wifiInterface}` }
  }

  // 2. Check wireless mode via iw (modern replacement for deprecated iwconfig).
  //    Must not be Monitor or Master (AP) — skip Master check when called
  //    from monitor (hotspot may be running).
  try {
    const { stdout: modeOutput } = await execAsync(
      `iw dev ${safeArg(wifiInterface)} info 2>/dev/null`,
    )
    const isMonitor = modeOutput.includes("type monitor")
    const isMaster = modeOutput.includes("type AP")

    if (isMonitor || (isMaster && !opts?.skipApModeCheck)) {
      const modeName = isMonitor ? "Monitor" : "AP"
      try {
        await execAsync(`sudo iw dev ${safeArg(wifiInterface)} set type managed`)
        console.log(`[network] Switched ${wifiInterface} from ${modeName} to Managed`)
        // Allow mode switch to settle before subsequent operations
        await new Promise((r) => setTimeout(r, 1000))

        // Verify the mode actually changed
        try {
          const { stdout: verifyOut } = await execAsync(
            `iw dev ${safeArg(wifiInterface)} info 2>/dev/null`,
          )
          const stillBad = isMonitor
            ? verifyOut.includes("type monitor")
            : verifyOut.includes("type AP")
          if (stillBad) {
            console.error(
              `[network] Failed to switch ${wifiInterface} from ${modeName} to Managed — driver may not support mode change`,
            )
            return { ok: false, reason: `Cannot switch ${wifiInterface} out of ${modeName} mode` }
          }
        } catch {
          // verification failed but mode switch command succeeded — continue
        }
      } catch (switchErr) {
        console.error(
          `[network] Mode switch command failed for ${wifiInterface}:`,
          (switchErr as Error).message,
        )
        return { ok: false, reason: `Failed to switch ${wifiInterface} from ${modeName} to Managed` }
      }
    }
  } catch (err) {
    const msg = (err as Error).message ?? ""
    if (msg.includes("no wireless extensions") || msg.includes("No such device")) {
      // Not a wireless interface — non-fatal
      console.log(`[network] ${wifiInterface} is not a wireless interface, skipping mode check`)
    } else {
      console.error(`[network] iw error for ${wifiInterface}:`, msg)
      return { ok: false, reason: `Cannot check wireless mode: ${msg}` }
    }
  }

  return { ok: true }
}

/** Ensure the fixed IP is always bound to the interface as secondary.
 *  This means the device is always reachable at 172.16.42.1 whether
 *  in hotspot mode or connected to an external WiFi network. */
export async function ensureStaticIp(state: NetworkServiceState): Promise<void> {
  // Avoid redundant sudo calls — only add once per process lifetime
  if (state.staticIpEnsured) return

  const { wifiInterface, hotspotIp } = await state.getConfig()

  try {
    // Check if IP already exists on interface (exact match via word boundary)
    const { stdout } = await execAsync(`ip -4 addr show dev ${safeArg(wifiInterface)}`)
    const ipRegex = new RegExp(`\\b${escapeRegex(hotspotIp)}\\b`)
    if (!ipRegex.test(stdout)) {
      await execAsync(`sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(wifiInterface)}`)
    }
    state.staticIpEnsured = true
  } catch {
    // Non-fatal — the device can still work, just not on the fixed IP
    console.warn(`[network] Failed to add static IP ${hotspotIp} on ${wifiInterface}`)
  }
}

/** Restore NM management after a brief offline period where NM was unmanaged
 *  to prevent auto-reconnect, but WiFi reconnected before hotspot started. */
export async function remanageNM(state: NetworkServiceState): Promise<void> {
  const { wifiInterface } = await state.getConfig()
  try {
    await execAsync("systemctl is-active --quiet NetworkManager")
    await execAsync(
      `sudo nmcli device set ${safeArg(wifiInterface)} managed yes 2>/dev/null || true`,
    )
    console.log(`[network] NM remanaged ${wifiInterface}`)

    // ponytail: wait for wpa_supplicant control socket — NM creates it
    // asynchronously after managing the interface. Without this, wpa_cli
    // fails with "No such file or directory".
    const socketPath = `/run/wpa_supplicant/${wifiInterface}`
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500))
      try {
        const { stdout } = await execAsync(`test -S ${socketPath} && echo ready`, 2000)
        if (stdout.includes("ready")) {
          console.log(`[network] wpa_supplicant socket ready after ${(i + 1) * 500}ms`)
          return
        }
      } catch { /* socket not ready yet */ }
    }
    console.warn(`[network] wpa_supplicant socket not ready after 5s — continuing anyway`)
  } catch { /* NM not running */ }
}

/** Unmanage WiFi interface from NetworkManager to prevent auto-reconnect
 *  while counting offline ticks toward hotspot start. */
export async function unmanageNM(state: NetworkServiceState): Promise<void> {
  const { wifiInterface } = await state.getConfig()
  try {
    await execAsync("systemctl is-active --quiet NetworkManager")
    await execAsync(
      `sudo nmcli device set ${safeArg(wifiInterface)} managed no 2>/dev/null || true`,
    )
    console.log(`[network] NM unmanaged ${wifiInterface}`)
  } catch { /* NM not running */ }
}
