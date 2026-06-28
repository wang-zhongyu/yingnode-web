// features/network/lib/network-monitor.ts
import type { NetworkService } from "@/shared/lib/network-service"

/** Start the background network monitor — checks WiFi association every 5s.
 *  WiFi not associated → start hotspot. WiFi associated → stop hotspot.
 *  5s anti-flap guard prevents rapid toggling. */
export function startNetworkMonitor(
  networkService: Pick<
    NetworkService,
    "isWiFiAssociated" | "getStatus" |
    "startHotspot" | "stopHotspot"
  >,
  isManualHotspotLocked: () => boolean,
) {
  let lastToggleTime = 0
  let checking = false

  const check = async () => {
    if (checking) return
    checking = true

    try {
      const status = await networkService.getStatus()
      const associated = await networkService.isWiFiAssociated()
      const now = Date.now()
      const sinceLastToggle = now - lastToggleTime

      console.log(
        `[monitor] associated=${associated} status=${status.status} ` +
        `hotspotActive=${status.hotspotActive}`,
      )

      // 5s anti-flap guard — don't toggle within 5s of last state change
      if (sinceLastToggle < 5000) {
        return
      }

      if (!associated && !status.hotspotActive) {
        if (isManualHotspotLocked()) {
          console.log("[monitor] Manual lock engaged, skipping startHotspot")
        } else {
          console.log("[monitor] WiFi not associated → starting hotspot")
          await networkService.startHotspot()
          lastToggleTime = Date.now()
        }
      }

      if (associated && status.hotspotActive) {
        if (isManualHotspotLocked()) {
          console.log("[monitor] Manual lock engaged, skipping stopHotspot")
        } else {
          console.log("[monitor] WiFi associated → stopping hotspot")
          await networkService.stopHotspot()
          lastToggleTime = Date.now()
        }
      }
    } catch (error) {
      console.error("[monitor] check error:", error)
    } finally {
      checking = false
    }
  }

  function scheduleNext() {
    setTimeout(() => {
      check().finally(scheduleNext)
    }, 5000)
  }

  check()
  scheduleNext()
}
