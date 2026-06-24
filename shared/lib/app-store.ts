import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { exec } from "child_process"
import { promisify } from "util"
import type { AppDefinition, AppWithStatus } from "@/shared/types/app"

const execAsync = promisify(exec)
const CONFIG_PATH = join(process.cwd(), "config", "apps.json")

class AppStore {
  private getDefinitions(): AppDefinition[] {
    if (!existsSync(CONFIG_PATH)) return []
    const raw = readFileSync(CONFIG_PATH, "utf-8")
    const config = JSON.parse(raw)
    return (config.apps ?? []) as AppDefinition[]
  }

  async getApps(): Promise<AppWithStatus[]> {
    const apps = this.getDefinitions()

    const result = await Promise.all(
      apps.map(async (app) => {
        let installed = false
        if (app.check) {
          try {
            await execAsync(app.check, { timeout: 5000 })
            installed = true
          } catch {
            installed = false
          }
        }
        return { ...app, installed, installing: false } satisfies AppWithStatus
      }),
    )

    return result
  }

  async installApp(id: string): Promise<boolean> {
    const app = this.getDefinitions().find((a) => a.id === id)
    if (!app) return false

    try {
      await execAsync(app.install, { timeout: 300000 })
      return true
    } catch {
      return false
    }
  }

  async uninstallApp(id: string): Promise<boolean> {
    const app = this.getDefinitions().find((a) => a.id === id)
    if (!app?.uninstall) return false

    try {
      await execAsync(app.uninstall, { timeout: 300000 })
      return true
    } catch {
      return false
    }
  }
}

export const appStore = new AppStore()
