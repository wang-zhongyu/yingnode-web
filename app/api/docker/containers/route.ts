import { NextResponse } from "next/server"
import { dockerService } from "@/shared/lib/docker-service"

export async function GET() {
  try {
    const containers = await dockerService.getContainers()
    return NextResponse.json({ containers })
  } catch {
    return NextResponse.json(
      { error: "Failed to list containers" },
      { status: 500 },
    )
  }
}
