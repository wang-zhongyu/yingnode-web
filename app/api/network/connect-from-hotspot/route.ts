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

  await setManualHotspotLock(true)

  try {
    // 1. Stop hotspot (also remanages NM)
    await networkService.stopHotspot()
    await new Promise((r) => setTimeout(r, 2000))

    // 2. Ensure interface is in managed mode
    const ready = await networkService.ensureInterfaceReady()
    if (!ready.ok) {
      try { await networkService.startHotspot() } catch { /* best-effort */ }
      return NextResponse.json(
        { success: false, ssid: null, ipAddress: null, error: `接口不可用: ${ready.reason}` },
        { status: 500 },
      )
    }

    // 3. Connect to WiFi
    const result = await networkService.connectWiFi(ssid, password, security)
    if (!result.success) {
      try { await networkService.startHotspot() } catch { /* best-effort */ }
      return NextResponse.json(result, { status: 422 })
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
    await setManualHotspotLock(false)
  }
}
