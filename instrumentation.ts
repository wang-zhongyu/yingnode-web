import { networkService } from "@/shared/lib/network-service"

let monitorStarted = false

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !monitorStarted) {
    monitorStarted = true
    startNetworkMonitor()
  }
}

function startNetworkMonitor() {
  let consecutiveFailures = 0
  let consecutiveSuccesses = 0

  const check = async () => {
    try {
      const online = await networkService.isOnline()
      const status = await networkService.getStatus()

      if (online) {
        consecutiveFailures = 0
        consecutiveSuccesses++

        if (status.hotspotActive && consecutiveSuccesses >= 3) {
          await networkService.stopHotspot()
          consecutiveSuccesses = 0
        }
      } else {
        consecutiveSuccesses = 0
        consecutiveFailures++

        if (!status.hotspotActive && consecutiveFailures >= 3) {
          await networkService.startHotspot()
        }

        if (status.status !== "HOTSPOT_ACTIVE" && consecutiveFailures >= 3) {
          await networkService.updateDB({ status: "OFFLINE" })
        }
      }
    } catch (error) {
      console.error("[monitor] check error:", error)
    }
  }

  check()
  setInterval(check, 10_000)
}
