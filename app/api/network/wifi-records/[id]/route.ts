import { NextResponse } from "next/server"
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
