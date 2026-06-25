import { NextRequest, NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"
import { setManualHotspotLock } from "@/shared/lib/hotspot-lock"

const VALID_SECURITY = ["WPA2", "WPA", "OPEN"] as const

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { ssid, password, security } = body ?? {}

  if (!ssid || typeof ssid !== "string") {
    return NextResponse.json(
      { success: false, ssid: null, ipAddress: null, error: "SSID 不能为空" },
      { status: 400 },
    )
  }

  if (security && !VALID_SECURITY.includes(security)) {
    return NextResponse.json(
      { success: false, ssid: null, ipAddress: null, error: "无效的安全类型" },
      { status: 400 },
    )
  }

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
      return NextResponse.json(
        {
          success: false,
          ssid: null,
          ipAddress: null,
          error: `接口不可用: ${ready.reason}`,
        },
        { status: 500 },
      )
    }

    // 4. Connect to the user-specified WiFi network
    const result = await networkService.connectWiFi(ssid, password, security)
    if (!result.success) {
      try { await networkService.startHotspot() } catch { /* best-effort */ }
      return NextResponse.json(result, { status: 422 })
    }

    // 5. Verify internet connectivity with retries
    //    DHCP + routing may take additional time beyond the 5s connectWiFi wait
    let online = false
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      online = await networkService.isOnline()
      if (online) break
    }

    if (!online) {
      try { await networkService.startHotspot() } catch { /* best-effort */ }
      return NextResponse.json(
        {
          success: false,
          ssid: result.ssid,
          ipAddress: result.ipAddress,
          error: "已连接到网络但无法访问互联网，热点已恢复",
        },
        { status: 422 },
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[connect-from-hotspot] Unexpected error:", error)
    try { await networkService.startHotspot() } catch { /* best-effort */ }
    return NextResponse.json(
      { success: false, ssid: null, ipAddress: null, error: "操作失败，热点已恢复" },
      { status: 500 },
    )
  } finally {
    setManualHotspotLock(false)
  }
}
