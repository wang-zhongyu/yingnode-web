import { spawn } from "child_process"
import { readFileSync } from "fs"
import { join } from "path"
import { networkService } from "@/shared/lib/network-service"
import { UpdateManager } from "@/shared/lib/update-manager"
import { execAsync } from "@/shared/lib/shell"

export const dynamic = "force-dynamic"

const SERVICE_RESTART = "systemctl restart yingnode 2>/dev/null || true"

function runStep(command: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", command], { cwd: process.cwd(), timeout: 300_000 })
    let output = ""
    proc.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString() })
    proc.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString() })
    proc.on("close", (code) => resolve({ ok: code === 0, output: output.slice(-4000) }))
    proc.on("error", (err) => resolve({ ok: false, output: err.message }))
  })
}

export async function POST() {
  const encoder = new TextEncoder()
  const INSTALL_DIR = process.cwd()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      let mgr: UpdateManager | null = null
      try {
        mgr = new UpdateManager()

        // CONNECTIVITY PRE-CHECK
        write({ step: "connectivity", message: "检查网络连通性", done: false })
        const online = await networkService.isOnline()
        if (!online) {
          write({
            step: "error",
            message: "设备当前离线，无法检查更新。请先连接互联网。",
            done: true,
          })
          controller.close()
          return
        }

        // Quick reachability check to the git remote
        try {
          await execAsync("git fetch origin main --dry-run", 15000)
        } catch {
          write({
            step: "error",
            message: "无法连接到更新服务器，请检查网络后重试。",
            done: true,
          })
          controller.close()
          return
        }
        write({ step: "connectivity", message: "网络连通性正常", done: true })

        // PRE-UPDATE SNAPSHOT
        write({ step: "snapshot", message: "创建回滚快照", done: false })
        await mgr.snapshot()
        write({ step: "snapshot", message: "创建回滚快照", done: true })

        const pkg = JSON.parse(readFileSync(join(INSTALL_DIR, "package.json"), "utf-8"))
        const oldVersion = pkg.version ?? "0.1.0"

        const steps = [
          { key: "fetch", label: "获取最新代码", cmd: "git fetch origin main" },
          { key: "pull", label: "合并代码", cmd: "git pull origin main" },
          { key: "install", label: "安装依赖", cmd: "npm ci --omit=dev" },
          { key: "prisma", label: "生成 Prisma Client", cmd: "npx prisma generate --no-engine" },
          { key: "build", label: "构建应用", cmd: "npm run build" },
          { key: "db", label: "同步数据库", cmd: "npx prisma db push --accept-data-loss" },
          { key: "restart", label: "重启服务", cmd: SERVICE_RESTART },
        ]

        for (const step of steps) {
          write({ step: step.key, message: step.label, done: false })
          const result = await runStep(step.cmd)
          if (!result.ok && step.key !== "restart") {
            write({ step: "rollback", message: `${step.label}失败，正在回滚...`, done: false })
            // Restore build files without restarting (restart would kill this process
            // before the SSE error event reaches the client)
            await mgr.rollback({ restart: false })
            write({
              step: "error",
              message: `更新失败：${step.label}。已回滚到更新前版本。`,
              output: result.output,
              done: true,
            })
            // Flush SSE before restart kills the process
            await new Promise((r) => setTimeout(r, 1000))
            controller.close()
            try { await execAsync(SERVICE_RESTART, 5000) } catch { /* restart kills process */ }
            return
          }
        }

        await mgr.cleanup()

        const newPkg = JSON.parse(readFileSync(join(INSTALL_DIR, "package.json"), "utf-8"))
        write({
          step: "done",
          message: `更新完成 ${oldVersion} → ${newPkg.version ?? "0.1.0"}`,
          oldVersion,
          newVersion: newPkg.version ?? "0.1.0",
          done: true,
        })
      } catch (err) {
        try { await mgr?.rollback({ restart: false }) } catch { /* best-effort */ }
        write({ step: "error", message: (err as Error).message, done: true })
        // Flush SSE before restart
        await new Promise((r) => setTimeout(r, 1000))
        controller.close()
        try { await execAsync(SERVICE_RESTART, 5000) } catch { /* restart kills process */ }
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
