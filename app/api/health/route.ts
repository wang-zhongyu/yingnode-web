import { NextResponse } from "next/server"
import { prisma } from "@/shared/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Quick DB connectivity check
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", timestamp: Date.now() })
  } catch {
    return NextResponse.json(
      { status: "degraded", timestamp: Date.now() },
      { status: 503 },
    )
  }
}
