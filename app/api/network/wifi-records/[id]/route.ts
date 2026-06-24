import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const ssid = body.ssid as string | undefined
    if (!ssid) {
      return NextResponse.json(
        { error: "ssid is required" },
        { status: 400 },
      )
    }
    const numericId = parseInt(id, 10)
    if (!Number.isFinite(numericId)) {
      return NextResponse.json(
        { error: "invalid id" },
        { status: 400 },
      )
    }
    await networkService.forgetWiFi(numericId, ssid)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[network/wifi-records] delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete WiFi record" },
      { status: 500 },
    )
  }
}
