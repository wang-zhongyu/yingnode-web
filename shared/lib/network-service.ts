import { prisma } from "@/shared/lib/prisma"
import { getDeviceConfig } from "@/shared/lib/device-config"
import { execAsync, escapeShellArg, safeArg } from "@/shared/lib/shell"
import type { NetworkStatus, WiFiNetwork, ConnectResult } from "@/shared/types/network"

// Connectivity check targets — use DNS servers reachable from both China and global networks
const PING_TARGETS = ["223.5.5.5", "114.114.114.114", "8.8.8.8"]

export class NetworkService {
  private staticIpEnsured = false
  private configCache: Awaited<ReturnType<typeof getDeviceConfig>> | null = null
  private configCacheTime: number = 0
  private static readonly CONFIG_CACHE_TTL_MS = 30_000 // 30 seconds
  private nmManagedIface: string | null = null

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

  /** Check if the yingnode dnsmasq process is running. */
  private async verifyDnsmasqRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync("pgrep -f 'dnsmasq.*dnsmasq-yingnode'", 3000)
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }

  /** Check and correct WiFi interface state before network operations.
   *  1. Bring interface UP if down
   *  2. Switch from Monitor/Master to Managed mode (skip Master when
   *     hotspot is active — switching mode while hostapd runs can kill
   *     the AP on some drivers, and on nl80211 it fails with EBUSY)
   *  Returns false only if the interface is missing entirely. */
  async ensureInterfaceReady(opts?: {
    skipApModeCheck?: boolean
  }): Promise<{ ok: boolean; reason?: string }> {
    const { wifiInterface } = await this.getConfig()

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

  /** Tell NetworkManager to manage or unmanage the WiFi interface. */
  private async toggleNM(managed: boolean, iface: string): Promise<void> {
    const action = managed ? "managed yes" : "managed no"
    try {
      await execAsync("systemctl is-active --quiet NetworkManager")
      await execAsync(
        `sudo nmcli device set ${safeArg(iface)} ${action} 2>/dev/null || true`,
      )
    } catch { /* NetworkManager not running — ok */ }
  }

  /** Register process exit handlers to restore NM management on crash/stop. */
  private registerNMRecovery(iface: string): void {
    if (this.nmManagedIface) return // already registered
    this.nmManagedIface = iface

    const restore = () =>
      this.toggleNM(true, iface).catch(() => {})

    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.once(signal, () => {
        restore().finally(() => process.exit(0))
      })
    }
  }

  /** Ensure the fixed IP is always bound to the interface as secondary.
   *  This means the device is always reachable at 172.16.42.1 whether
   *  in hotspot mode or connected to an external WiFi network. */
  async ensureStaticIp(): Promise<void> {
    // Avoid redundant sudo calls — only add once per process lifetime
    if (this.staticIpEnsured) return

    const { wifiInterface, hotspotIp } = await this.getConfig()

    try {
      // Check if IP already exists on interface (exact match via word boundary)
      const { stdout } = await execAsync(`ip -4 addr show dev ${safeArg(wifiInterface)}`)
      const ipRegex = new RegExp(
        `\\b${hotspotIp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      )
      if (!ipRegex.test(stdout)) {
        await execAsync(`sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(wifiInterface)}`)
      }
      this.staticIpEnsured = true
    } catch {
      // Non-fatal — the device can still work, just not on the fixed IP
      console.warn(`[network] Failed to add static IP ${hotspotIp} on ${wifiInterface}`)
    }
  }

  /** Try each ping target; succeed if any responds. Avoids false offline
   *  detection when a single target is blocked (e.g. GFW blocks 8.8.8.8). */
  async checkConnectivity(): Promise<boolean> {
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

  async isOnline(): Promise<boolean> {
    const pingOk = await this.checkConnectivity()
    if (pingOk) return true
    // Fallback: check if interface has an external DHCP IP — device may be
    // connected to a network that blocks ICMP or our specific ping targets
    const hasExternal = await this.hasExternalIp()
    return hasExternal
  }

  /** Check if WiFi has an IP from an external network (not the hotspot IP)
   *  AND is actually associated with an access point.
   *  A stale DHCP IP lingering after disconnection does not count. */
  async hasExternalIp(): Promise<boolean> {
    const { wifiInterface, hotspotIp } = await this.getConfig()
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

  private lastHotspotFailure = 0
  private static readonly HOTSPOT_RETRY_COOLDOWN_MS = 300_000 // 5 minutes
  private startingHotspot = false
  lastHotspotError: string | null = null

  /** Restore NM management after a brief offline period where NM was unmanaged
   *  to prevent auto-reconnect, but WiFi reconnected before hotspot started. */
  async remanageNM(): Promise<void> {
    const { wifiInterface } = await this.getConfig()
    try {
      await execAsync("systemctl is-active --quiet NetworkManager")
      await execAsync(
        `sudo nmcli device set ${safeArg(wifiInterface)} managed yes 2>/dev/null || true`,
      )
      console.log(`[network] NM remanaged ${wifiInterface}`)
    } catch { /* NM not running */ }
  }

  /** Unmanage WiFi interface from NetworkManager to prevent auto-reconnect
   *  while counting offline ticks toward hotspot start. */
  async unmanageNM(): Promise<void> {
    const { wifiInterface } = await this.getConfig()
    try {
      await execAsync("systemctl is-active --quiet NetworkManager")
      await execAsync(
        `sudo nmcli device set ${safeArg(wifiInterface)} managed no 2>/dev/null || true`,
      )
      console.log(`[network] NM unmanaged ${wifiInterface}`)
    } catch { /* NM not running */ }
  }

  /** Check if WiFi interface is associated with an access point.
   *  This is the single source of truth for "connected to WiFi". */
  async isWiFiAssociated(): Promise<boolean> {
    const { wifiInterface } = await this.getConfig()
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

  async startHotspot(): Promise<void> {
    // Prevent concurrent start attempts
    if (this.startingHotspot) return
    this.startingHotspot = true

    try {
      await this.startHotspotInternal()
    } finally {
      this.startingHotspot = false
    }
  }

  private async startHotspotInternal(): Promise<void> {
    const existingStatus = await this.getStatus()
    if (existingStatus.hotspotActive) return

    if (Date.now() - this.lastHotspotFailure < NetworkService.HOTSPOT_RETRY_COOLDOWN_MS) {
      return
    }

    const { wifiInterface, hotspotSsid, hotspotPassword, hotspotIp } =
      await this.getConfig()

    console.log("[network] Starting hotspot...")
    this.lastHotspotError = null

    // 1. Bring interface up and set to managed mode
    try {
      await execAsync(`sudo ip link set ${safeArg(wifiInterface)} up`)
      // Switch to managed mode if in monitor/AP mode from previous state
      try {
        const { stdout: infoOut } = await execAsync(
          `iw dev ${safeArg(wifiInterface)} info 2>/dev/null`,
        )
        if (infoOut.includes("type monitor") || infoOut.includes("type AP")) {
          await execAsync(`sudo iw dev ${safeArg(wifiInterface)} set type managed`)
          await new Promise((r) => setTimeout(r, 1000))
        }
      } catch { /* non-fatal */ }
    } catch (err) {
      this.lastHotspotError = `接口启动失败: ${(err as Error).message}`
      console.error("[network]", this.lastHotspotError)
      this.lastHotspotFailure = Date.now()
      return
    }

    // 2. Unmanage from NM so it doesn't interfere with hostapd
    try {
      await execAsync("systemctl is-active --quiet NetworkManager")
      await execAsync(
        `sudo nmcli device set ${safeArg(wifiInterface)} managed no 2>/dev/null || true`,
      )
    } catch { /* NM not running */ }

    // 3. Set static IP
    try {
      const { stdout: ipOut } = await execAsync(
        `ip -4 addr show dev ${safeArg(wifiInterface)}`,
      )
      const escapedIp = hotspotIp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      if (!new RegExp(`\\b${escapedIp}\\b`).test(ipOut)) {
        await execAsync(`sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(wifiInterface)}`)
      }
    } catch {
      console.warn("[network] Failed to set static IP — continuing anyway")
    }

    // 4. Write hostapd config and start
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

      // Start hostapd in background
      await execAsync(`sudo hostapd -B ${configPath}`)

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
      const dnsmasqRunning = await this.verifyDnsmasqRunning()
      if (!dnsmasqRunning) {
        throw new Error("dnsmasq failed to start")
      }

      await this.updateDB({ status: "HOTSPOT_ACTIVE", hotspotActive: true })
      hotspotStarted = true
      this.lastHotspotError = null
      console.log("[network] Hotspot started successfully")
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      this.lastHotspotError = `热点启动失败: ${msg}`
      console.error("[network]", this.lastHotspotError)
      // Clean up whatever we started
      try { await execAsync("sudo killall hostapd") } catch { /* ok */ }
      try { await execAsync("sudo killall dnsmasq") } catch { /* ok */ }
      try { await fs.unlink(configPath) } catch { /* ok */ }
      try { await fs.unlink(dnsmasqConfigPath) } catch { /* ok */ }
      this.lastHotspotFailure = Date.now()
    } finally {
      if (!hotspotStarted) {
        // Restore NM management so external WiFi can work again
        try {
          await execAsync("systemctl is-active --quiet NetworkManager")
          await execAsync(
            `sudo nmcli device set ${safeArg(wifiInterface)} managed yes 2>/dev/null || true`,
          )
        } catch { /* NM not running */ }
        await this.updateDB({ status: "OFFLINE", hotspotActive: false })
      }
    }
  }

  async stopHotspot(): Promise<void> {
    const status = await this.getStatus()
    if (!status.hotspotActive) return

    console.log("[network] Stopping hotspot...")
    const { wifiInterface } = await this.getConfig()

    // Kill hotspot services
    try { await execAsync("sudo killall hostapd") } catch { /* ok */ }
    try { await execAsync("sudo killall dnsmasq") } catch { /* ok */ }

    // Clean up temp configs
    try {
      const fs = await import("fs/promises")
      await fs.unlink("/tmp/hostapd-yingnode.conf")
      await fs.unlink("/tmp/dnsmasq-yingnode.conf")
    } catch { /* ok */ }

    // Keep static IP on interface so device remains reachable
    try {
      const { hotspotIp } = await this.getConfig()
      const { stdout } = await execAsync(
        `ip -4 addr show dev ${safeArg(wifiInterface)}`,
      )
      if (!stdout.includes(hotspotIp)) {
        await execAsync(
          `sudo ip addr add ${safeArg(hotspotIp)}/24 dev ${safeArg(wifiInterface)}`,
        )
      }
    } catch { /* non-fatal */ }

    // Restore NM management
    try {
      await execAsync("systemctl is-active --quiet NetworkManager")
      await execAsync(
        `sudo nmcli device set ${safeArg(wifiInterface)} managed yes 2>/dev/null || true`,
      )
    } catch { /* NM not running */ }

    await this.updateDB({ status: "ONLINE", hotspotActive: false })
    console.log("[network] Hotspot stopped")
  }

  async scanWiFi(): Promise<WiFiNetwork[]> {
    const { wifiInterface } = await this.getConfig()
    try {
      const { stdout } = await execAsync(`sudo iwlist ${safeArg(wifiInterface)} scan`, 10000)
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
  async getInterfaceStatuses(): Promise<
    Array<{ name: string; state: "UP" | "DOWN" | "UNKNOWN"; ipv4s: string[] }>
  > {
    try {
      const { hotspotIp } = await this.getConfig()
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

  /** Sync WiFi networks from wpa_supplicant into the database.
   *  Uses wpa_cli list_networks to read saved networks from the WiFi interface. */
  private async syncWpaSupplicantNetworks(): Promise<void> {
    try {
      const { wifiInterface } = await this.getConfig()
      const { stdout } = await execAsync(
        `wpa_cli -i ${safeArg(wifiInterface)} list_networks`,
        5000,
      )
      const lines = stdout.split("\n").slice(1)
      for (const line of lines) {
        const parts = line.split("\t")
        if (parts.length < 2) continue
        const id = parseInt(parts[0], 10)
        const ssid = parts[1]
        if (isNaN(id) || !ssid || ssid === "\\x00") continue
        try {
          const existing = await prisma.wiFiRecord.findUnique({ where: { ssid } })
          if (!existing) {
            await prisma.wiFiRecord.create({ data: { ssid, security: "WPA2" } })
          }
        } catch {
          // skip duplicates or DB errors silently
        }
      }
    } catch {
      // wpa_cli may not be available — that's ok
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
    await this.syncWpaSupplicantNetworks()
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
      const { stdout } = await execAsync(
        `wpa_cli -i ${safeArg(iface)} list_networks`,
      )
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

  /** Remove a saved WiFi network from both wpa_supplicant and the database.
   *  Loads the record by id to get the authoritative SSID — the caller cannot
   *  specify a different SSID than the one stored for this record. */
  async forgetWiFi(id: number): Promise<boolean> {
    const record = await prisma.wiFiRecord.findUnique({ where: { id } })
    if (!record) {
      throw new Error("WiFi record not found")
    }

    const { wifiInterface } = await this.getConfig()

    // Check if this is the currently-connected SSID
    const status = await this.getStatus()
    const isCurrentConnection = status.currentSSID === record.ssid

    try {
      const networkId = await this.getWpaNetworkId(record.ssid, wifiInterface)
      if (networkId !== null) {
        await execAsync(
          `wpa_cli -i ${safeArg(wifiInterface)} remove_network ${networkId}`,
        )
        // If this was the active connection, disconnect so the monitor
        // detects offline and starts the hotspot within ~10s
        if (isCurrentConnection) {
          try {
            await execAsync(`wpa_cli -i ${safeArg(wifiInterface)} disconnect`)
          } catch { /* interface may already be down */ }
        }
        await execAsync(`wpa_cli -i ${safeArg(wifiInterface)} save_config`)
      }
    } catch (err) {
      console.warn(
        `[network] Failed to remove wpa_cli network for "${record.ssid}":`,
        err,
      )
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
      const { stdout } = await execAsync(`ip -4 addr show dev ${safeArg(wifiInterface)}`)
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
    const escapedSSID = escapeShellArg(ssid)

    try {
      // First try wpa_cli (works when NM manages the interface on Kali)
      const { stdout: addOut } = await execAsync(
        `sudo wpa_cli -i ${safeArg(wifiInterface)} add_network`,
      )
      const networkId = parseInt(addOut.trim(), 10)
      if (isNaN(networkId)) {
        return { success: false, ssid: null, ipAddress: null, error: "无法创建网络配置" }
      }

      if (password) {
        // safeArg wraps in single quotes — protects ! and other special chars
        // from bash history expansion that escapes double-quoted values
        const safePwd = safeArg(password)
        await execAsync(
          `sudo wpa_cli -i ${safeArg(wifiInterface)} set_network ${networkId} ssid '"${escapedSSID}"'`,
        )
        await execAsync(
          `sudo wpa_cli -i ${safeArg(wifiInterface)} set_network ${networkId} psk ${safePwd}`,
        )
      } else {
        await execAsync(
          `sudo wpa_cli -i ${safeArg(wifiInterface)} set_network ${networkId} ssid '"${escapedSSID}"'`,
        )
        await execAsync(
          `sudo wpa_cli -i ${safeArg(wifiInterface)} set_network ${networkId} key_mgmt NONE`,
        )
      }

      await execAsync(`sudo wpa_cli -i ${safeArg(wifiInterface)} enable_network ${networkId}`)
      // save_config / reconfigure may fail on DBus-managed wpa_supplicant
      // (no writable config file) — non-fatal, network is already added
      try { await execAsync(`sudo wpa_cli -i ${safeArg(wifiInterface)} save_config`) } catch { /* ok */ }
      try { await execAsync(`sudo wpa_cli -i ${safeArg(wifiInterface)} reconfigure`) } catch { /* ok */ }

      // Poll for DHCP-assigned IP address (up to 20s)
      const DHCP_MAX_WAIT_MS = 20000
      const dhcpStart = Date.now()
      let ipAddress: string | null = null

      while (Date.now() - dhcpStart < DHCP_MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const { stdout } = await execAsync(
            `sudo wpa_cli -i ${safeArg(wifiInterface)} status`, 3000,
          )
          const m = stdout.match(/ip_address=(\S+)/)
          if (m && m[1] && m[1] !== "0.0.0.0" && !m[1].startsWith("169.254")) {
            ipAddress = m[1]
            break
          }
          const stateMatch = stdout.match(/wpa_state=(\S+)/)
          if (stateMatch) {
            const s = stateMatch[1]
            if (s === "DISCONNECTED" || s === "INACTIVE" || s === "INTERFACE_DISABLED") break
          }
        } catch { /* keep polling */ }
      }

      if (!ipAddress) {
        try {
          const { stdout: fallback } = await execAsync(
            `sudo wpa_cli -i ${safeArg(wifiInterface)} status`, 3000,
          )
          ipAddress = fallback.match(/ip_address=(\S+)/)?.[1] ?? null
        } catch { /* best-effort */ }
      }

      this.staticIpEnsured = false
      await this.ensureStaticIp()

      await this.updateDB({ currentSSID: ssid, ipAddress })

      try {
        await prisma.wiFiRecord.upsert({
          where: { ssid },
          update: { lastUsed: new Date() },
          create: { ssid, security: security ?? (password ? "WPA2" : "OPEN") },
        })
      } catch { /* non-fatal */ }

      return { success: true, ssid, ipAddress }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "连接失败"
      if (msg.includes("WRONG_KEY")) {
        return { success: false, ssid: null, ipAddress: null, error: "密码错误" }
      }
      if (msg.includes("command not found") || msg.includes("ENOENT")) {
        return { success: false, ssid: null, ipAddress: null, error: "wpa_cli 未安装或不可用" }
      }
      if (msg.includes("timed out") || msg.includes("ETIMEDOUT")) {
        return { success: false, ssid: null, ipAddress: null, error: "连接超时" }
      }
      // Extract wpa_cli stderr for diagnostics
      let detail = ""
      if (error instanceof Error && "stderr" in error) {
        detail = (error as { stderr?: string }).stderr ?? ""
      }
      console.error(`[network] connectWiFi failed: ${msg}${detail ? ` | stderr: ${detail}` : ""}`)
      return { success: false, ssid: null, ipAddress: null, error: `连接失败: ${msg.slice(0, 80)}` }
    }
  }
}

export const networkService = new NetworkService()
