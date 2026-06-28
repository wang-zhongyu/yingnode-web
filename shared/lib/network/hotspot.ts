import { execAsync, safeArg } from "@/shared/lib/shell"
import { escapeRegex } from "./constants"
import type { NetworkServiceState } from "./constants"
import { getStatus, updateDB } from "./db-status"

const HOTSPOT_RETRY_COOLDOWN_MS = 30_000 // 30 seconds

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

  // Remove static IP
  try {
    const { hotspotIp } = await state.getConfig()
    await execAsync(
      `sudo ip addr del ${hotspotIp}/24 dev ${safeArg(wifiInterface)}`,
    )
  } catch { /* non-fatal */ }

  // Clean up virtual AP interface if it exists (from old code)
  try { await execAsync("sudo iw dev uap0 del 2>/dev/null || true", 2000) } catch { /* ok */ }

  // Restore NM management
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

  // 1. Bring interface up
  try {
    await execAsync(`sudo ip link set ${safeArg(wifiInterface)} up`)
  } catch (err) {
    state.lastHotspotError = `接口启动失败: ${(err as Error).message}`
    console.error("[network]", state.lastHotspotError)
    state.lastHotspotFailure = Date.now()
    return
  }

  // 2. Release interface from NM and wpa_supplicant.
  //    brcmfmac returns -EBUSY if wpa_supplicant holds the interface when
  //    hostapd tries to set AP mode. Kill everything holding wlan0.
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

  // 3. Switch to managed mode to give hostapd a clean state.
  try {
    const { stdout: infoOut } = await execAsync(
      `iw dev ${safeArg(wifiInterface)} info 2>/dev/null`,
    )
    if (infoOut.includes("type monitor") || infoOut.includes("type AP")) {
      await execAsync(`sudo iw dev ${safeArg(wifiInterface)} set type managed`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  } catch { /* non-fatal */ }

  // 4. Set static IP
  try {
    const { stdout: ipOut } = await execAsync(
      `ip -4 addr show dev ${safeArg(wifiInterface)}`,
    )
    if (!new RegExp(`\\b${escapeRegex(hotspotIp)}\\b`).test(ipOut)) {
      await execAsync(`sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(wifiInterface)}`)
    }
  } catch {
    console.warn("[network] Failed to set static IP — continuing anyway")
  }

  // 5. Write configs and start services
  const subnet = hotspotIp.split(".").slice(0, 3).join(".")
  const configPath = "/tmp/hostapd-yingnode.conf"
  const dnsmasqConfigPath = "/tmp/dnsmasq-yingnode.conf"
  const fs = await import("fs/promises")

  const hostapdConfig = [
    `interface=${wifiInterface}`,
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
    `interface=${wifiInterface}`,
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
    await new Promise((r) => setTimeout(r, 500))

    // Start hostapd — redirect stderr, hostapd prints diagnostics even on success
    await execAsync(`sudo hostapd -B ${configPath} 2>/dev/null`)

    // Wait for AP mode (up to 10s)
    let apReady = false
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      try {
        const { stdout } = await execAsync(
          `iw dev ${safeArg(wifiInterface)} info 2>/dev/null`,
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
        `ip -4 addr show dev ${safeArg(wifiInterface)}`,
      )
      if (!ipOut2.includes(hotspotIp)) {
        await execAsync(`sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(wifiInterface)}`)
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
