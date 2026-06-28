// app/api/monitoring/history/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/lib/prisma"
import { historyQuerySchema } from "@/features/monitoring/schemas/monitoring.schema"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const { minutes } = historyQuerySchema.parse({
      minutes: searchParams.get("minutes"),
    })

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
