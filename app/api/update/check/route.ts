import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { readFileSync } from "fs"
import { join } from "path"

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Current version from package.json
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"))
    const currentVersion = pkg.version ?? "0.1.0"

    // Fetch latest from remote without merging
    await execAsync("git fetch origin main", { timeout: 15000 })

    // Count commits behind
    const { stdout: behind } = await execAsync("git rev-list --count HEAD..origin/main")
    const commitsBehind = parseInt(behind.trim()) || 0

    // Latest commit info
    const { stdout: latestLog } = await execAsync(
      "git log origin/main -3 --oneline --format='%h %s (%cr)'",
    )
    const latestCommits = latestLog.trim().split("\n").filter(Boolean)

    return NextResponse.json({
      currentVersion,
      commitsBehind,
      hasUpdate: commitsBehind > 0,
      latestCommits,
    })
  } catch {
    return NextResponse.json({
      currentVersion: "0.1.0",
      commitsBehind: 0,
      hasUpdate: false,
      latestCommits: [],
      error: "无法检查更新，请确认网络连接",
    })
  }
}
