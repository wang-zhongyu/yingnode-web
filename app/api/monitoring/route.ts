import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { systemMonitor } = await import("@/shared/lib/system-monitor")
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
