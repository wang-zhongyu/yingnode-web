"use server"

import { actionClient } from "@/shared/lib/safe-action"
import { manualAddSchema, connectFromHotspotSchema } from "@/features/network/schemas/network.schema"
import { networkService } from "@/shared/lib/network-service"
import { setManualHotspotLock } from "@/shared/lib/hotspot-lock"

export const connectWiFiAction = actionClient
  .schema(manualAddSchema)
  .action(async ({ parsedInput: { ssid, password, security } }) => {
    const result = await networkService.connectWiFi(ssid, password, security)
    if (!result.success) {
      throw new Error(result.error ?? "连接失败")
    }
    return result
  })

export const connectFromHotspotAction = actionClient
  .schema(connectFromHotspotSchema)
  .action(async ({ parsedInput: { ssid, password, security } }) => {
    // Prevent monitor from auto-starting hotspot during this operation
    setManualHotspotLock(true)

    try {
      // 1. Stop hotspot
      await networkService.stopHotspot()

      // 2. Allow interface to leave AP mode (hostapd teardown is async)
      await new Promise((r) => setTimeout(r, 2000))

      // 3. Ensure interface is in managed mode and ready for wpa_cli
      const ready = await networkService.ensureInterfaceReady()
      if (!ready.ok) {
        try { await networkService.startHotspot() } catch { /* best-effort */ }
        throw new Error(`接口不可用: ${ready.reason}`)
      }

      // 4. Connect to the user-specified WiFi network
      const result = await networkService.connectWiFi(ssid, password, security)
      if (!result.success) {
        try { await networkService.startHotspot() } catch { /* best-effort */ }
        throw new Error(result.error ?? "连接失败，热点已恢复")
      }

      // 5. Verify internet connectivity with retries
      let online = false
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        online = await networkService.isOnline()
        if (online) break
      }

      if (!online) {
        try { await networkService.startHotspot() } catch { /* best-effort */ }
        throw new Error("已连接到网络但无法访问互联网，热点已恢复")
      }

      return result
    } catch (error) {
      // If we already threw, re-throw so onError receives the message
      if (error instanceof Error && error.message !== "操作失败，热点已恢复") {
        // Try to restore hotspot for any unexpected error
        try { await networkService.startHotspot() } catch { /* best-effort */ }
      }
      throw error
    } finally {
      setManualHotspotLock(false)
    }
  })
