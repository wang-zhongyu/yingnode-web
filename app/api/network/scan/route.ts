import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  const networks = await networkService.scanWiFi()
  return NextResponse.json({ networks })
}
