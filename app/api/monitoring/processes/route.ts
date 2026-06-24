// app/api/monitoring/processes/route.ts
import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { processesQuerySchema } from "@/features/monitoring/schemas/monitoring.schema"
import type { ProcessInfo } from "@/shared/types/monitoring"

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { sort, limit } = processesQuerySchema.parse({
      sort: searchParams.get("sort"),
      limit: searchParams.get("limit"),
    })

    const sortFlag = sort === "mem" ? "-%mem" : "-%cpu"

    const { stdout } = await execAsync(
      `ps aux --sort=${sortFlag} --no-headers | head -n ${limit}`,
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
          name: (fields.slice(10).join(" ") || fields[0]) ?? "unknown",
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
