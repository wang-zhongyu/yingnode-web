import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"
import { getDeviceConfig } from "@/shared/lib/device-config"

export async function GET() {
  try {
    const [status, reachableIp, config] = await Promise.all([
      networkService.getStatus(),
      networkService.getReachableIp(),
      getDeviceConfig(),
    ])
    return NextResponse.json({
      ...status,
      reachableIp,
      hotspotSsid: config.hotspotSsid,
      hotspotIp: config.hotspotIp,
      wifiInterface: config.wifiInterface,
    })
  } catch (error) {
    console.error("[network/status] error:", error)
    return NextResponse.json(
      { error: "Failed to read network status" },
      { status: 500 },
    )
  }
}
