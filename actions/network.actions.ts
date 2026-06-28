"use server"

import { z } from "zod"
import { actionClient, authActionClient } from "@/shared/lib/safe-action"
import { manualAddSchema } from "@/features/network/schemas/network.schema"
import { networkService } from "@/shared/lib/network-service"
import { setManualHotspotLock } from "@/shared/lib/hotspot-lock"

async function connectFromHotspotImpl(ssid: string, password: string, security: string) {
  // 1. Stop hotspot — cleans interface (managed mode, down/up reset), no NM
  await networkService.stopHotspot()

  // 2. Wait for interface to settle after firmware reset
  await new Promise((r) => setTimeout(r, 2000))

  // 3. Bring interface to managed mode (ensure up, type managed)
  const ready = await networkService.ensureInterfaceReady()
  if (!ready.ok) {
    try { await networkService.startHotspot() } catch { /* ok */ }
    throw new Error(`接口不可用: ${ready.reason}`)
  }

  // 4. Connect to WiFi via standalone wpa_supplicant
  const result = await networkService.connectWiFi(ssid, password, security)
  if (!result.success) {
    try { await networkService.startHotspot() } catch { /* ok */ }
    throw new Error(result.error ?? "连接失败，热点已恢复")
  }

  // 5. Detect the reachable IP for user
  // ponytail: 1s settle — DHCP already done in connectWiFi, just routing
  await new Promise((r) => setTimeout(r, 1000))
  const reachableIp = await networkService.getReachableIp()

  return { ...result, reachableIp }
}

export const connectWiFiAction = actionClient
  .schema(manualAddSchema)
  .action(async ({ parsedInput: { ssid, password, security } }) => {
    const status = await networkService.getStatus()
    console.log(
      `[action] connectWiFiAction: ssid="${ssid}" hotspotActive=${status.hotspotActive} status=${status.status}`,
    )
    if (!status.hotspotActive) {
      console.log("[action] → direct connectWiFi path")
      // Lock to prevent monitor from starting hotspot mid-connection
      await setManualHotspotLock(true)
      try {
        const result = await networkService.connectWiFi(ssid, password, security)
        if (!result.success) throw new Error(result.error ?? "连接失败")
        return result
      } finally {
        await setManualHotspotLock(false)
      }
    }

    console.log("[action] → connectFromHotspotImpl path")
    await setManualHotspotLock(true)
    try {
      return await connectFromHotspotImpl(ssid, password ?? "", security)
    } finally {
      await setManualHotspotLock(false)
    }
  })

export const connectFromHotspotAction = actionClient
  .schema(manualAddSchema)
  .action(async ({ parsedInput: { ssid, password, security } }) => {
    await setManualHotspotLock(true)
    try {
      return await connectFromHotspotImpl(ssid, password ?? "", security)
    } finally {
      await setManualHotspotLock(false)
    }
  })

export const reconnectWiFiAction = authActionClient
  .schema(z.object({ id: z.number() }))
  .action(async ({ parsedInput: { id } }) => {
    const records = await networkService.getSavedWiFi()
    const target = records.find((r) => r.id === id)
    if (!target || target.networkId == null) {
      throw new Error("网络配置已失效，请重新输入密码连接")
    }
    return networkService.reconnectViaNetworkId(target.networkId, target.ssid)
  })

export const forgetWiFiAction = authActionClient
  .schema(z.object({ id: z.number() }))
  .action(async ({ parsedInput: { id } }) => {
    return networkService.forgetWiFi(id)
  })
