// app/api/monitoring/history/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const minutes = Math.min(
      Math.max(parseInt(searchParams.get("minutes") ?? "60", 10), 1),
      1440,
    )

    const since = new Date(Date.now() - minutes * 60 * 1000)

    const records = await prisma.metricsSnapshot.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select: {
        timestamp: true,
        cpuUsage: true,
        memUsed: true,
        memTotal: true,
        diskUsed: true,
        diskTotal: true,
        tempCelsius: true,
      },
    })

    return NextResponse.json({ records })
  } catch (error) {
    console.error("[monitoring/history] error:", error)
    return NextResponse.json(
      { records: [], error: "Failed to read metrics history" },
      { status: 500 },
    )
  }
}
