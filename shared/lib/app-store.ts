import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { spawn } from "child_process"
import type { AppDefinition, AppWithStatus } from "@/shared/types/app"
import { checkCommandSafety, backupNetworkConfig } from "@/shared/lib/app-store-safety"

const CONFIG_PATH = join(process.cwd(), "config", "apps.json")
const INSTALL_TIMEOUT = 600_000 // 10 minutes

function execCommand(command: string, timeoutMs = INSTALL_TIMEOUT): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", command], {
      env: { ...process.env, DEBIAN_FRONTEND: "noninteractive" },
      timeout: timeoutMs,
    })

    let output = ""
    proc.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString()
    })
    proc.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString()
    })

    // Auto-answer "yes" to simple prompts (curl installers that ask "Continue? [y/N]")
    const autoYes = setInterval(() => {
      proc.stdin?.write("y\n")
    }, 2000)

    proc.on("close", (code) => {
      clearInterval(autoYes)
      resolve({ ok: code === 0, output: output.slice(-4000) })
    })

    proc.on("error", (err) => {
      clearInterval(autoYes)
      resolve({ ok: false, output: err.message })
    })
  })
}

class AppStore {
  private getDefinitions(): AppDefinition[] {
    if (!existsSync(CONFIG_PATH)) return []
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8")
      const config = JSON.parse(raw)
      return (config.apps ?? []) as AppDefinition[]
    } catch (err) {
      console.error("[app-store] Failed to parse apps.json:", err)
      return []
    }
  }

  async getApps(): Promise<AppWithStatus[]> {
    const apps = this.getDefinitions()

    const result = await Promise.all(
      apps.map(async (app) => {
        let installed = false
        if (app.check) {
          try {
            const { ok } = await execCommand(app.check, 5000)
            installed = ok
          } catch {
            installed = false
          }
        }
        return { ...app, installed, installing: false } satisfies AppWithStatus
      }),
    )

    return result
  }

  async installApp(id: string): Promise<{ ok: boolean; output: string; warnings?: string[] }> {
    const app = this.getDefinitions().find((a) => a.id === id)
    if (!app) return { ok: false, output: `应用 ${id} 不存在` }

    // Pre-flight safety check
    const { safe, warnings } = checkCommandSafety(app.install)
    if (!safe) {
      console.warn(`[app-store] Dangerous patterns in install script for "${id}":`, warnings)
    }

    // Backup network config before execution
    const backupPath = await backupNetworkConfig()
    if (backupPath) {
      console.log(`[app-store] Network config backed up to ${backupPath}`)
    }

    const result = await execCommand(app.install)

    return {
      ok: result.ok,
      output: result.output,
      ...(warnings.length > 0 ? { warnings } : {}),
    }
  }

  async uninstallApp(id: string): Promise<{ ok: boolean; output: string; warnings?: string[] }> {
    const app = this.getDefinitions().find((a) => a.id === id)
    if (!app?.uninstall) return { ok: false, output: "该应用不支持卸载" }

    // Pre-flight safety check
    const { warnings } = checkCommandSafety(app.uninstall)
    if (warnings.length > 0) {
      console.warn(`[app-store] Dangerous patterns in uninstall script for "${id}":`, warnings)
    }

    const result = await execCommand(app.uninstall)

    return {
      ok: result.ok,
      output: result.output,
      ...(warnings.length > 0 ? { warnings } : {}),
    }
  }
}

export const appStore = new AppStore()
