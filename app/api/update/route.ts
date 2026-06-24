import { spawn } from "child_process"
import { readFileSync } from "fs"
import { join } from "path"

export const dynamic = "force-dynamic"

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

      try {
        const pkg = JSON.parse(readFileSync(join(INSTALL_DIR, "package.json"), "utf-8"))
        const oldVersion = pkg.version ?? "0.1.0"

        const steps = [
          { key: "fetch", label: "获取最新代码", cmd: "git fetch origin main" },
          { key: "pull", label: "合并代码", cmd: "git pull origin main" },
          { key: "install", label: "安装依赖", cmd: "npm ci --omit=dev" },
          { key: "prisma", label: "生成 Prisma Client", cmd: "npx prisma generate --no-engine" },
          { key: "build", label: "构建应用", cmd: "npm run build" },
          { key: "db", label: "同步数据库", cmd: "npx prisma db push --accept-data-loss" },
          { key: "restart", label: "重启服务", cmd: "systemctl restart yingnode 2>/dev/null || true" },
        ]

        for (const step of steps) {
          write({ step: step.key, message: step.label, done: false })
          const result = await runStep(step.cmd)
          if (!result.ok && step.key !== "restart") {
            write({
              step: "error",
              message: `${step.label}失败`,
              output: result.output,
              done: true,
            })
            controller.close()
            return
          }
        }

        const newPkg = JSON.parse(readFileSync(join(INSTALL_DIR, "package.json"), "utf-8"))
        write({
          step: "done",
          message: `更新完成 ${oldVersion} → ${newPkg.version ?? "0.1.0"}`,
          oldVersion,
          newVersion: newPkg.version ?? "0.1.0",
          done: true,
        })
      } catch (err) {
        write({ step: "error", message: (err as Error).message, done: true })
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
