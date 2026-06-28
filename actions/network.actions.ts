"use server"

import { z } from "zod"
import { actionClient, authActionClient } from "@/shared/lib/safe-action"
import { manualAddSchema } from "@/features/network/schemas/network.schema"
import { networkService } from "@/shared/lib/network-service"
import { setManualHotspotLock } from "@/shared/lib/hotspot-lock"

async function connectFromHotspotImpl(ssid: string, password: string, security: string) {
  // 1. Stop hotspot (also remanages NM and removes static IP)
  await networkService.stopHotspot()
  await new Promise((r) => setTimeout(r, 2000))

  // 2. Bring interface to managed mode
  const ready = await networkService.ensureInterfaceReady()
  if (!ready.ok) {
    try { await networkService.startHotspot() } catch { /* ok */ }
    throw new Error(`接口不可用: ${ready.reason}`)
  }

  // 3. Connect to WiFi
  const result = await networkService.connectWiFi(ssid, password, security)
  if (!result.success) {
    try { await networkService.startHotspot() } catch { /* ok */ }
    throw new Error(result.error ?? "连接失败，热点已恢复")
  }

  // 4. Detect the reachable IP for user
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
      setManualHotspotLock(true)
      try {
        const result = await networkService.connectWiFi(ssid, password, security)
        if (!result.success) throw new Error(result.error ?? "连接失败")
        return result
      } finally {
        setManualHotspotLock(false)
      }
    }

    console.log("[action] → connectFromHotspotImpl path")
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
