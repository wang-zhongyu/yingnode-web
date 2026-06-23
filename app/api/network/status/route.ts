import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  const status = await networkService.getStatus()
  return NextResponse.json(status)
}
