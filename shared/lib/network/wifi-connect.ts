import { prisma } from "@/shared/lib/prisma"
import { execAsync, safeArg } from "@/shared/lib/shell"
import type { ConnectResult } from "@/shared/types/network"
import { WPA_SOCKET_DIR, WPA_SOCKET_CLI, WPA_CONFIG } from "./constants"
import type { NetworkServiceState } from "./constants"
import { getStatus, updateDB } from "./db-status"
import { HOTSPOT_IFACE } from "./hotspot"

/** Start a standalone wpa_supplicant instance with a known control socket,
 *  independent of NetworkManager. This ensures wpa_cli commands always work
 *  and the socket is never destroyed by NM during connection attempts. */
export async function ensureStandaloneWpa(state: NetworkServiceState): Promise<void> {
  const { wifiInterface } = await state.getConfig()

  // Kill any existing system wpa_supplicant to free the interface
  try { await execAsync("sudo killall wpa_supplicant", 3000) } catch { /* ok */ }

  // Write minimal config
  try {
    const fs = await import("fs/promises")
    await fs.mkdir(WPA_SOCKET_DIR, { recursive: true })
    await fs.writeFile(
      WPA_CONFIG,
      `ctrl_interface=${WPA_SOCKET_DIR}\nupdate_config=1\n`,
    )
    // Ensure correct permissions
    await execAsync(`sudo chmod 755 ${WPA_SOCKET_DIR}`, 2000).catch(() => {})
    await execAsync(`sudo chmod 644 ${WPA_CONFIG}`, 2000).catch(() => {})
  } catch { /* ok */ }

  // Start standalone wpa_supplicant on the WiFi interface
  await execAsync(
    `sudo wpa_supplicant -B -i ${safeArg(wifiInterface)} -c ${WPA_CONFIG} -D nl80211`,
    5000,
  )

  // Wait for control socket
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const { stdout } = await execAsync(
        `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} ping`, 2000,
      )
      if (stdout.includes("PONG")) {
        console.log(`[network] Standalone wpa_supplicant ready after ${(i + 1) * 500}ms`)
        return
      }
    } catch { /* keep waiting */ }
  }
  console.warn("[network] Standalone wpa_supplicant not ready after 5s — continuing anyway")
}

export async function connectWiFi(
  state: NetworkServiceState,
  ssid: string,
  password?: string,
  security?: string,
): Promise<ConnectResult> {
  const { wifiInterface } = await state.getConfig()

  console.log(`[network] connectWiFi: ssid="${ssid}" via standalone wpa_supplicant`)

  // Ensure standalone wpa_supplicant is running with our socket
  await ensureStandaloneWpa(state)

  // Use hex-encoded SSID — avoids all shell/wpa_cli quoting issues
  const ssidHex = Buffer.from(ssid, "utf-8").toString("hex")

  try {
    const { stdout: addOut } = await execAsync(
      `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} add_network`,
    )
    const networkId = parseInt(addOut.trim(), 10)
    if (isNaN(networkId)) {
      return { success: false, ssid: null, ipAddress: null, error: "无法创建网络配置" }
    }

    if (password) {
      // safeArg wraps in single quotes — protects ! and other special chars
      const safePwd = safeArg(password)
      await execAsync(
        `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} set_network ${networkId} ssid ${ssidHex}`,
      )
      await execAsync(
        `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} set_network ${networkId} psk ${safePwd}`,
      )
    } else {
      await execAsync(
        `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} set_network ${networkId} ssid ${ssidHex}`,
      )
      await execAsync(
        `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} set_network ${networkId} key_mgmt NONE`,
      )
    }

    console.log(`[network] wpa_cli add_network → id=${networkId}, enabling...`)
    await execAsync(`sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} enable_network ${networkId}`)
    await execAsync(`sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} select_network ${networkId}`)

    // Wait for wpa_state COMPLETED (up to 15s)
    let wpaState = "?"
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const { stdout } = await execAsync(
          `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} status`, 3000,
        )
        wpaState = stdout.match(/wpa_state=(\S+)/)?.[1] ?? "?"
        console.log(`[network] poll #${i + 1}: wpa_state=${wpaState}`)
        if (wpaState === "COMPLETED") break
        if (wpaState === "DISCONNECTED" || wpaState === "INACTIVE" || wpaState === "INTERFACE_DISABLED") break
      } catch { /* keep waiting */ }
    }

    if (wpaState !== "COMPLETED") {
      const reason = wpaState === "WRONG_KEY" ? "密码错误" :
        wpaState === "?" ? "无法获取连接状态" :
        `连接未完成 (${wpaState})`
      return { success: false, ssid: null, ipAddress: null, error: reason }
    }

    // Release static IP temporarily so dhcpcd can bind the DHCP address
    const { hotspotIp } = await state.getConfig()
    try { await execAsync(`sudo ip addr del ${hotspotIp}/24 dev ${safeArg(wifiInterface)}`) } catch { /* ok */ }

    // Run dhcpcd to get DHCP IP from the WiFi router
    let ipAddress: string | null = null
    try {
      await execAsync(`sudo dhcpcd -n ${safeArg(wifiInterface)}`, 15000)
      // Read the DHCP-assigned IP
      const { stdout: ipOut } = await execAsync(
        `ip -4 addr show dev ${safeArg(wifiInterface)}`, 3000,
      )
      const allIps = [...ipOut.matchAll(/inet (\d+\.\d+\.\d+\.\d+)\/\d+/g)].map(m => m[1])
      ipAddress = allIps.find(ip => ip !== hotspotIp) ?? null
    } catch (e) {
      console.warn(`[network] dhcpcd failed: ${(e as Error).message}`)
    }

    // Static IP is only for hotspot mode — when on external WiFi,
    // the device is reachable via its DHCP-assigned IP.

    await updateDB({ currentSSID: ssid, ipAddress })

    // Save record for reconnection
    try {
      await prisma.wiFiRecord.upsert({
        where: { ssid },
        update: { lastUsed: new Date(), networkId },
        create: { ssid, security: security ?? (password ? "WPA2" : "OPEN"), networkId },
      })
    } catch { /* non-fatal */ }

    console.log(
      `[network] connectWiFi OK: ssid="${ssid}" networkId=${networkId} wpa_state=${wpaState} ip=${ipAddress ?? "none"}`,
    )
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

/** Reconnect to a previously-saved network using standalone wpa_supplicant. */
export async function reconnectViaNetworkId(
  state: NetworkServiceState,
  _networkId: number,
  ssid: string,
): Promise<ConnectResult> {
  const { wifiInterface } = await state.getConfig()

  await ensureStandaloneWpa(state)

  try {
    const { stdout: listOut } = await execAsync(
      `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} list_networks`, 3000,
    )
    const hasNetwork = listOut.split("\n").some((line) => line.startsWith(`${_networkId}\t`))
    if (!hasNetwork) {
      return { success: false, ssid: null, ipAddress: null, error: "网络配置已失效，请重新输入密码连接" }
    }

    console.log(`[network] reconnectViaNetworkId: id=${_networkId} ssid="${ssid}"`)
    await execAsync(`sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} enable_network ${_networkId}`)
    await execAsync(`sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} select_network ${_networkId}`)

    let ipAddress: string | null = null
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const { stdout } = await execAsync(
          `sudo wpa_cli ${WPA_SOCKET_CLI} -i ${safeArg(wifiInterface)} status`, 3000,
        )
        const m = stdout.match(/ip_address=(\S+)/)
        if (m && m[1] && m[1] !== "0.0.0.0" && !m[1].startsWith("169.254")) {
          ipAddress = m[1]
          break
        }
      } catch { /* keep polling */ }
    }

    await updateDB({ currentSSID: ssid, ipAddress })
    await prisma.wiFiRecord.update({
      where: { ssid },
      data: { lastUsed: new Date() },
    }).catch(() => {})

    console.log(`[network] reconnectViaNetworkId OK: ssid="${ssid}" ip=${ipAddress ?? "none"}`)
    return { success: true, ssid, ipAddress }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "重连失败"
    console.error(`[network] reconnectViaNetworkId failed: ${msg}`)
    return { success: false, ssid: null, ipAddress: null, error: msg }
  }
}

/** Get the IP address that other devices on the current network can use to
 *  reach this device. In hotspot mode returns the fixed hotspot IP.
 *  On an external network returns the DHCP-assigned IP. */
export async function getReachableIp(state: NetworkServiceState): Promise<string | null> {
  const { wifiInterface, hotspotIp } = await state.getConfig()
  const status = await getStatus()

  // In hotspot mode, the IP is on the virtual AP interface (uap0), not wlan0
  const iface = status.hotspotActive ? HOTSPOT_IFACE : wifiInterface

  try {
    const { stdout } = await execAsync(`ip -4 addr show dev ${safeArg(iface)}`)
    const matches = [...stdout.matchAll(/inet (\d+\.\d+\.\d+\.\d+)\/\d+ scope global/g)]
    const ips = matches.map(m => m[1])

    if (status.hotspotActive) {
      return ips.includes(hotspotIp) ? hotspotIp : null
    }

    // In external WiFi mode: return the non-hotspot IP (DHCP or static LAN IP)
    return ips.find(ip => ip !== hotspotIp) ?? null
  } catch {
    return null
  }
}
