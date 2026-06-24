import { NextResponse } from "next/server"
import { dockerService } from "@/shared/lib/docker-service"
import type { ContainerAction } from "@/shared/types/docker"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const body = await request.json()
    const action = body.action as ContainerAction

    if (!["start", "stop", "restart"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use: start, stop, restart" },
        { status: 400 },
      )
    }

    await dockerService.containerAction(id, action)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to perform action on container" },
      { status: 500 },
    )
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const logs = await dockerService.getLogs(id)
    return NextResponse.json({ logs })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 },
    )
  }
}
