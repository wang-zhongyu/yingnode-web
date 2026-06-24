import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  try {
    const [status, reachableIp] = await Promise.all([
      networkService.getStatus(),
      networkService.getReachableIp(),
    ])
    return NextResponse.json({ ...status, reachableIp })
  } catch (error) {
    console.error("[network/status] error:", error)
    return NextResponse.json(
      { error: "Failed to read network status" },
      { status: 500 },
    )
  }
}
