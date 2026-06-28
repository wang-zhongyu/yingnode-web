"use server"

import { actionClient } from "@/shared/lib/safe-action"
import { manualAddSchema } from "@/features/network/schemas/network.schema"
import { networkService } from "@/shared/lib/network-service"
import { setManualHotspotLock } from "@/shared/lib/hotspot-lock"

async function connectFromHotspotImpl(ssid: string, password: string, security: string) {
  // 1. Stop hotspot and wait for AP teardown
  await networkService.stopHotspot()
  await new Promise((r) => setTimeout(r, 3000))

  // 2. Remanage NM so wpa_supplicant control socket is available
  await networkService.remanageNM()

  // 3. Bring interface UP (stopHotspot may have left it in transitional state)
  const ready = await networkService.ensureInterfaceReady()
  if (!ready.ok) {
    try { await networkService.startHotspot() } catch { /* ok */ }
    throw new Error(`接口不可用: ${ready.reason}`)
  }

  // 4. Connect — wpa_cli with sudo now works because NM manages the interface
  const result = await networkService.connectWiFi(ssid, password, security)
  if (!result.success) {
    try { await networkService.startHotspot() } catch { /* ok */ }
    throw new Error(result.error ?? "连接失败，热点已恢复")
  }

  // 5. Wait for DHCP to fully settle, then detect the reachable IP
  await new Promise((r) => setTimeout(r, 3000))
  const reachableIp = await networkService.getReachableIp()

  return { ...result, reachableIp }
}

export const connectWiFiAction = actionClient
  .schema(manualAddSchema)
  .action(async ({ parsedInput: { ssid, password, security } }) => {
    const status = await networkService.getStatus()
    if (!status.hotspotActive) {
      const result = await networkService.connectWiFi(ssid, password, security)
      if (!result.success) throw new Error(result.error ?? "连接失败")
      return result
    }

    setManualHotspotLock(true)
    try {
      return await connectFromHotspotImpl(ssid, password ?? "", security)
    } finally {
      setManualHotspotLock(false)
    }
  })

export const connectFromHotspotAction = actionClient
  .schema(manualAddSchema)
  .action(async ({ parsedInput: { ssid, password, security } }) => {
    setManualHotspotLock(true)
    try {
      return await connectFromHotspotImpl(ssid, password ?? "", security)
    } finally {
      setManualHotspotLock(false)
    }
  })
