// features/network/lib/network-monitor.ts
import type { NetworkService } from "@/shared/lib/network-service"

/** Start the background network monitor — checks WiFi association + connectivity
 *  every 10s and manages hotspot start/stop based on online/offline state. */
export function startNetworkMonitor(
  networkService: Pick<
    NetworkService,
    "isWiFiAssociated" | "checkConnectivity" | "getStatus" |
    "startHotspot" | "stopHotspot" | "updateDB" | "unmanageNM" | "remanageNM"
  >,
  isManualHotspotLocked: () => boolean,
) {
  // Debounce counters — only act after N consecutive same-state ticks
  let offlineTicks = 0
  let onlineTicks = 0
  let checking = false

  const check = async () => {
    if (checking) return
    checking = true

    try {
      const status = await networkService.getStatus()
      const associated = await networkService.isWiFiAssociated()
      console.log(
        `[monitor] associated=${associated} status=${status.status} ` +
        `hotspotActive=${status.hotspotActive} offlineTicks=${offlineTicks} onlineTicks=${onlineTicks}`,
      )

      // While hotspot is active, AP mode shows as "not associated" —
      // prevent offlineTicks from accumulating and retriggering start.
      if (status.hotspotActive) {
        offlineTicks = 0
      }

      if (associated) {
        // WiFi is connected to an AP — verify internet access.
        // WiFi reconnected — restore NM if it was unmanaged during offline period
        if (offlineTicks > 0) {
          networkService.remanageNM().catch(() => {})
          networkService.updateDB({ status: "ONLINE" }).catch(() => {})
        }
        offlineTicks = 0
        const pingOk = await networkService.checkConnectivity()

        if (pingOk) {
          onlineTicks++
          // Stop hotspot after 3 consecutive confirmed-online ticks
          if (status.hotspotActive && onlineTicks >= 3) {
            if (isManualHotspotLocked()) {
              console.log("[monitor] Hotspot locked, skipping stopHotspot")
            } else {
              await networkService.stopHotspot()
              onlineTicks = 0
            }
          }
        } else {
          // Associated but no internet (captive portal, firewall)
          // Don't start hotspot — user is on a network, just restricted
          onlineTicks = 0
        }
      } else {
        // WiFi is NOT connected to any AP
        onlineTicks = 0
        offlineTicks++

        // After 2 offline ticks (20s), unmanage NM to prevent it from
        // auto-reconnecting while we count toward hotspot start.
        // Skip if manually locked (user-initiated WiFi connect in progress).
        if (offlineTicks === 2 && !isManualHotspotLocked()) {
          networkService.unmanageNM().catch(() => {})
        }

        if (!status.hotspotActive && offlineTicks >= 3) {
          if (isManualHotspotLocked()) {
            console.log("[monitor] Hotspot locked, skipping startHotspot")
          } else {
            await networkService.startHotspot()
            offlineTicks = 0
          }
        }

        if (status.status !== "HOTSPOT_ACTIVE" && offlineTicks >= 3) {
          await networkService.updateDB({ status: "OFFLINE" })
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
    }, 10_000)
  }

  check()
  scheduleNext()
}
