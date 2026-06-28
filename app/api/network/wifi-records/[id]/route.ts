import { NextRequest, NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const numericId = parseInt(id, 10)
    if (!Number.isFinite(numericId)) {
      return NextResponse.json(
        { error: "invalid id" },
        { status: 400 },
      )
    }
    await networkService.forgetWiFi(numericId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[network/wifi-records] delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete WiFi record" },
      { status: 500 },
    )
  }
}

/** Reconnect to a saved WiFi network using its wpa_supplicant network ID. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    // Load the record to get networkId and ssid
    const records = await networkService.getSavedWiFi()
    const record = records.find((r) => r.id === parseInt(id, 10))
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }
    if (record.networkId == null) {
      return NextResponse.json(
        { error: "该网络需要通过密码重新连接" },
        { status: 400 },
      )
    }

    const result = await networkService.reconnectViaNetworkId(
      record.networkId,
      record.ssid,
    )
    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("[network/wifi-records] reconnect error:", error)
    return NextResponse.json(
      { error: "Failed to reconnect" },
      { status: 500 },
    )
  }
}
