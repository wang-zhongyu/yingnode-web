import { NextResponse } from "next/server"
import { dockerService } from "@/shared/lib/docker-service"

export async function GET() {
  try {
    const [containers, dockerAvailable] = await Promise.all([
      dockerService.getContainers(),
      dockerService.isAvailable(),
    ])
    return NextResponse.json({ containers, dockerAvailable })
  } catch {
    return NextResponse.json(
      { error: "Failed to list containers" },
      { status: 500 },
    )
  }
}
