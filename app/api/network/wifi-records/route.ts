import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  try {
    const records = await networkService.getSavedWiFi()
    return NextResponse.json({ records })
  } catch (error) {
    console.error("[network/wifi-records] error:", error)
    return NextResponse.json(
      { error: "Failed to read WiFi records" },
      { status: 500 },
    )
  }
}
