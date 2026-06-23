import { NextRequest, NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { ssid, password } = body

  if (!ssid) {
    return NextResponse.json(
      { success: false, ssid: null, ipAddress: null, error: "SSID 不能为空" },
      { status: 400 }
    )
  }

  const result = await networkService.connectWiFi(ssid, password)
  if (!result.success) {
    return NextResponse.json(result, { status: 422 })
  }
  return NextResponse.json(result)
}
