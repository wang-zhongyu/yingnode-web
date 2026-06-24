// app/api/monitoring/disk/route.ts
import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function GET() {
  try {
    const { stdout } = await execAsync("df -h", { timeout: 5000 })

    const lines = stdout.trim().split("\n")
    const dataLines = lines.slice(1)

    const partitions = dataLines.map((line) => {
      const fields = line.trim().split(/\s+/)
      return {
        filesystem: fields[0] ?? "unknown",
        size: fields[1] ?? "0",
        used: fields[2] ?? "0",
        available: fields[3] ?? "0",
        usePercent: fields[4] ?? "0%",
        mountedOn: fields[5] ?? "/",
      }
    })

    return NextResponse.json({ partitions })
  } catch (error) {
    console.error("[monitoring/disk] error:", error)
    return NextResponse.json(
      { partitions: [], error: "Failed to read disk info" },
      { status: 500 },
    )
  }
}
