import { NextResponse } from "next/server"
import { systemMonitor } from "@/shared/lib/system-monitor"

export async function GET() {
  try {
    const metrics = await systemMonitor.getMetrics()
    return NextResponse.json(metrics)
  } catch (error) {
    console.error("[monitoring] error:", error)
    return NextResponse.json(
      { error: "Failed to read system metrics" },
      { status: 500 },
    )
  }
}
