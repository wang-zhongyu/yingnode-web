import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  try {
    const interfaces = await networkService.getInterfaceStatuses()
    return NextResponse.json({ interfaces })
  } catch (error) {
    console.error("[network/interfaces] error:", error)
    return NextResponse.json(
      { error: "Failed to read interface statuses" },
      { status: 500 },
    )
  }
}
