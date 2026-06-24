// app/api/monitoring/processes/route.ts
import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  mem: number
  user: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get("sort") === "mem" ? "-%mem" : "-%cpu"
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "50", 10), 1),
      100,
    )

    const { stdout } = await execAsync(
      `ps aux --sort=${sort} --no-headers | head -n ${limit}`,
      { timeout: 5000 },
    )

    const processes: ProcessInfo[] = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const fields = line.trim().split(/\s+/)
        return {
          user: fields[0] ?? "unknown",
          pid: parseInt(fields[1] ?? "0", 10),
          cpu: parseFloat(fields[2] ?? "0"),
          mem: parseFloat(fields[3] ?? "0"),
          name: fields.slice(10).join(" ") || fields[0] ?? "unknown",
        }
      })

    return NextResponse.json({ processes })
  } catch (error) {
    console.error("[monitoring/processes] error:", error)
    return NextResponse.json(
      { processes: [], error: "Failed to read processes" },
      { status: 500 },
    )
  }
}
