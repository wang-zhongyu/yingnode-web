import { NextResponse } from "next/server"
import { appStore } from "@/shared/lib/app-store"

export async function GET() {
  try {
    const apps = await appStore.getApps()
    return NextResponse.json({ apps })
  } catch {
    return NextResponse.json({ error: "Failed to list apps" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, action } = body as { id: string; action: "install" | "uninstall" }

    if (!id) {
      return NextResponse.json({ error: "App id is required" }, { status: 400 })
    }

    let success: boolean
    if (action === "install") {
      success = await appStore.installApp(id)
    } else if (action === "uninstall") {
      success = await appStore.uninstallApp(id)
    } else {
      return NextResponse.json(
        { error: "Action must be install or uninstall" },
        { status: 400 },
      )
    }

    return NextResponse.json({ success })
  } catch {
    return NextResponse.json(
      { error: "Failed to perform app action" },
      { status: 500 },
    )
  }
}
