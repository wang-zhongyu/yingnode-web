import { execAsync, safeArg } from "@/shared/lib/shell"
import { escapeRegex } from "./constants"
import type { NetworkServiceState } from "./constants"
import { getStatus, updateDB } from "./db-status"

const HOTSPOT_RETRY_COOLDOWN_MS = 300_000 // 5 minutes

/** Virtual AP interface name. On brcmfmac (Raspberry Pi 5), the main interface
 *  (wlan0) cannot switch between managed and AP mode reliably — the driver
 *  returns -EBUSY if any other process has the interface open. Creating a
 *  dedicated virtual AP interface leaves wlan0 in managed mode for normal
 *  WiFi while uap0 handles the hotspot. */
export const HOTSPOT_IFACE = "uap0"

/** Check if the yingnode dnsmasq process is running. */
export async function verifyDnsmasqRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("pgrep -f 'dnsmasq.*dnsmasq-yingnode'", 3000)
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

export async function stopHotspot(state: NetworkServiceState): Promise<void> {
  const status = await getStatus()
  if (!status.hotspotActive) return

  console.log("[network] Stopping hotspot...")
  const { wifiInterface } = await state.getConfig()

  // Kill hotspot services
  try { await execAsync("sudo killall hostapd") } catch { /* ok */ }
  try { await execAsync("sudo killall dnsmasq") } catch { /* ok */ }

  // Clean up temp configs
  try {
    const fs = await import("fs/promises")
    await fs.unlink("/tmp/hostapd-yingnode.conf")
    await fs.unlink("/tmp/dnsmasq-yingnode.conf")
  } catch { /* ok */ }

  // Delete virtual AP interface
  try { await execAsync(`sudo iw dev ${HOTSPOT_IFACE} del`, 3000) } catch { /* ok */ }

  // Restore NM management on main WiFi interface
  try {
    await execAsync("systemctl is-active --quiet NetworkManager")
    await execAsync(
      `sudo nmcli device set ${safeArg(wifiInterface)} managed yes 2>/dev/null || true`,
    )
  } catch { /* NM not running */ }

  await updateDB({ status: "ONLINE", hotspotActive: false })
  console.log("[network] Hotspot stopped")
}

export async function startHotspotInternal(state: NetworkServiceState): Promise<void> {
  const existingStatus = await getStatus()
  if (existingStatus.hotspotActive) return

  if (Date.now() - state.lastHotspotFailure < HOTSPOT_RETRY_COOLDOWN_MS) {
    return
  }

  const { wifiInterface, hotspotSsid, hotspotPassword, hotspotIp } =
    await state.getConfig()

  console.log("[network] Starting hotspot...")
  state.lastHotspotError = null

  // 1. Bring main interface up
  try {
    await execAsync(`sudo ip link set ${safeArg(wifiInterface)} up`)
  } catch (err) {
    state.lastHotspotError = `接口启动失败: ${(err as Error).message}`
    console.error("[network]", state.lastHotspotError)
    state.lastHotspotFailure = Date.now()
    return
  }

  // 2. Disconnect NM + kill wpa_supplicant to release the interface.
  //    On brcmfmac, iw dev ... interface add fails if wpa_supplicant holds it.
  try {
    await execAsync("systemctl is-active --quiet NetworkManager")
    await execAsync(
      `sudo nmcli device disconnect ${safeArg(wifiInterface)} 2>/dev/null || true`,
    )
    await execAsync(
      `sudo nmcli device set ${safeArg(wifiInterface)} managed no 2>/dev/null || true`,
    )
  } catch { /* NM not running */ }
  try { await execAsync("sudo killall wpa_supplicant", 3000) } catch { /* ok */ }
  await new Promise((r) => setTimeout(r, 1000))

  // 3. Create virtual AP interface — brcmfmac can't switch wlan0 between
  //    managed and AP mode reliably, but supports a dedicated virtual AP.
  const apIface = HOTSPOT_IFACE
  try {
    // Clean up stale uap0 from a previous crash
    await execAsync(`sudo iw dev ${apIface} del 2>/dev/null || true`, 2000)
    await execAsync(`sudo iw dev ${safeArg(wifiInterface)} interface add ${apIface} type __ap`)
    console.log(`[network] Created virtual AP interface ${apIface}`)
  } catch (err) {
    state.lastHotspotError = `创建 AP 接口失败: ${(err as Error).message}`
    console.error("[network]", state.lastHotspotError)
    state.lastHotspotFailure = Date.now()
    return
  }

  // 4. Set static IP on the virtual AP interface
  try {
    const { stdout: ipOut } = await execAsync(
      `ip -4 addr show dev ${safeArg(apIface)}`,
    )
    if (!new RegExp(`\\b${escapeRegex(hotspotIp)}\\b`).test(ipOut)) {
      await execAsync(`sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(apIface)}`)
    }
  } catch {
    console.warn("[network] Failed to set static IP — continuing anyway")
  }

  // 5. Write hostapd config and start
  const subnet = hotspotIp.split(".").slice(0, 3).join(".")
  const configPath = "/tmp/hostapd-yingnode.conf"
  const dnsmasqConfigPath = "/tmp/dnsmasq-yingnode.conf"
  const fs = await import("fs/promises")

  const hostapdConfig = [
    `interface=${apIface}`,
    "driver=nl80211",
    `ssid=${hotspotSsid}`,
    "hw_mode=g",
    "channel=6",
    "wmm_enabled=0",
    "macaddr_acl=0",
    "auth_algs=1",
    "ignore_broadcast_ssid=0",
  ]
  if (hotspotPassword) {
    hostapdConfig.push(
      "wpa=2",
      `wpa_passphrase=${hotspotPassword}`,
      "wpa_key_mgmt=WPA-PSK",
      "wpa_pairwise=TKIP",
      "rsn_pairwise=CCMP",
    )
  }

  const dnsmasqConfig = [
    `interface=${apIface}`,
    "bind-interfaces",
    "dhcp-authoritative",
    `dhcp-range=${subnet}.10,${subnet}.50,255.255.255.0,12h`,
    `dhcp-option=3,${hotspotIp}`,
    `dhcp-option=6,${hotspotIp}`,
    "no-resolv",
    `address=/#/${hotspotIp}`,
    "log-dhcp",
  ]

  let hotspotStarted = false
  try {
    await fs.writeFile(configPath, hostapdConfig.join("\n") + "\n", { mode: 0o600 })
    await fs.writeFile(dnsmasqConfigPath, dnsmasqConfig.join("\n") + "\n", { mode: 0o600 })

    // Start hostapd in background
    await execAsync(`sudo hostapd -B ${configPath}`)

    // Wait for AP mode (up to 10s)
    let apReady = false
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      try {
        const { stdout } = await execAsync(
          `iw dev ${safeArg(apIface)} info 2>/dev/null`,
        )
        if (stdout.includes("type AP")) { apReady = true; break }
      } catch { /* keep waiting */ }
    }
    if (!apReady) {
      console.warn("[network] AP mode not confirmed after 10s, continuing anyway")
    }

    // Re-bind IP (some drivers drop it during mode switch)
    try {
      const { stdout: ipOut2 } = await execAsync(
        `ip -4 addr show dev ${safeArg(apIface)}`,
      )
      if (!ipOut2.includes(hotspotIp)) {
        await execAsync(`sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(apIface)}`)
      }
    } catch { /* non-fatal */ }

    // Start dnsmasq
    await execAsync(`sudo dnsmasq -C ${dnsmasqConfigPath}`)

    // Verify dnsmasq is running
    const dnsmasqRunning = await verifyDnsmasqRunning()
    if (!dnsmasqRunning) {
      throw new Error("dnsmasq failed to start")
    }

    await updateDB({ status: "HOTSPOT_ACTIVE", hotspotActive: true })
    hotspotStarted = true
    state.lastHotspotError = null
    console.log("[network] Hotspot started successfully")
  } catch (err) {
    const msg = (err as Error).message ?? String(err)
    state.lastHotspotError = `热点启动失败: ${msg}`
    console.error("[network]", state.lastHotspotError)
    // Clean up whatever we started
    try { await execAsync("sudo killall hostapd") } catch { /* ok */ }
    try { await execAsync("sudo killall dnsmasq") } catch { /* ok */ }
    try { await fs.unlink(configPath) } catch { /* ok */ }
    try { await fs.unlink(dnsmasqConfigPath) } catch { /* ok */ }
    try { await execAsync(`sudo iw dev ${apIface} del`, 2000) } catch { /* ok */ }
    state.lastHotspotFailure = Date.now()
  } finally {
    if (!hotspotStarted) {
      // Restore NM management so external WiFi can work again
      try {
        await execAsync("systemctl is-active --quiet NetworkManager")
        await execAsync(
          `sudo nmcli device set ${safeArg(wifiInterface)} managed yes 2>/dev/null || true`,
        )
      } catch { /* NM not running */ }
      await updateDB({ status: "OFFLINE", hotspotActive: false })
    }
  }
}
