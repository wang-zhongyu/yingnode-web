import { NextResponse } from "next/server"
import { prisma } from "@/shared/lib/prisma"
import { deviceConfigSchema } from "@/features/settings/schemas/device-config.schema"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  try {
    let config = await prisma.deviceConfig.findFirst({ where: { id: 1 } })

    if (!config) {
      config = await prisma.deviceConfig.create({
        data: { id: 1 },
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error("[settings/device] GET error:", error)
    return NextResponse.json(
      { error: "Failed to read device config" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const parsed = deviceConfigSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const config = await prisma.deviceConfig.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { id: 1, ...parsed.data },
    })

    // Clear network service cache so it picks up new config on next operation
    networkService.clearConfigCache()

    return NextResponse.json(config)
  } catch (error) {
    console.error("[settings/device] PUT error:", error)
    return NextResponse.json(
      { error: "Failed to update device config" },
      { status: 500 },
    )
  }
}
