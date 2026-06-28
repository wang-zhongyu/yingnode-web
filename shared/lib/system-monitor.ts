import "server-only"
import { readFile } from "node:fs/promises"
import type { SystemMetrics } from "@/shared/types/monitoring"
import { execAsync } from "@/shared/lib/shell"

class SystemMonitor {
  private prevIdle = 0
  private prevTotal = 0

  async getMetrics(): Promise<SystemMetrics> {
    const [cpu, memory, disk, temp, uptime] = await Promise.all([
      this.getCpuUsage().catch(() => ({ usage: 0 })),
      this.getMemory().catch(() => ({ total: 0, used: 0, usage: 0 })),
      this.getDisk().catch(() => ({ total: 0, used: 0, usage: 0 })),
      this.getTemp().catch(() => ({ celsius: 0 })),
      this.getUptime().catch(() => ({ days: 0, hours: 0, minutes: 0, totalSeconds: 0 })),
    ])

    return { cpu, memory, disk, temp, uptime }
  }

  private async getCpuUsage() {
    const data = await readFile(/* turbopackIgnore: true */ "/proc/stat", "utf-8")
    const line = data.split("\n").find((l) => l.startsWith("cpu "))

    if (!line) {
      return { usage: 0 }
    }

    const fields = line.trim().split(/\s+/).slice(1).map(Number)

    if (fields.length < 4) {
      return { usage: 0 }
    }

    const idle = fields[3] ?? 0
    const total = fields.reduce((sum, v) => sum + v, 0)

    const idleDiff = idle - this.prevIdle
    const totalDiff = total - this.prevTotal

    this.prevIdle = idle
    this.prevTotal = total

    if (totalDiff === 0 || this.prevTotal === 0) {
      return { usage: 0 }
    }

    const usage = Math.round(((totalDiff - idleDiff) / totalDiff) * 100)
    return { usage: Math.max(0, Math.min(100, usage)) }
  }

  private async getMemory() {
    const data = await readFile(/* turbopackIgnore: true */ "/proc/meminfo", "utf-8")
    const lines = data.split("\n")

    const getValue = (key: string) => {
      const line = lines.find((l) => l.startsWith(key))
      if (!line) return 0
      return parseInt(line.replace(key, "").replace("kB", "").trim(), 10) * 1024
    }

    const total = getValue("MemTotal:")
    const available = getValue("MemAvailable:")
    const used = total - available
    const usage = total > 0 ? Math.round((used / total) * 100) : 0

    return { total, used, usage }
  }

  private async getDisk() {
    const { stdout } = await execAsync(/* turbopackIgnore: true */ "df -B1 / | tail -1")
    const fields = stdout.trim().split(/\s+/)

    if (fields.length < 4) {
      return { total: 0, used: 0, usage: 0 }
    }

    const total = parseInt(fields[1] ?? "0", 10)
    const used = parseInt(fields[2] ?? "0", 10)
    const usage = total > 0 ? Math.round((used / total) * 100) : 0

    return { total, used, usage }
  }

  private async getTemp() {
    const paths = [
      "/sys/class/thermal/thermal_zone0/temp",
      "/sys/class/thermal/thermal_zone1/temp",
    ]
    for (const path of paths) {
      try {
        const data = await readFile(/* turbopackIgnore: true */ path, "utf-8")
        const millidegrees = parseInt(data.trim(), 10)
        if (!isNaN(millidegrees)) {
          return { celsius: Math.round(millidegrees / 1000) }
        }
      } catch {
        // try next path
      }
    }
    return { celsius: 0 }
  }

  private async getUptime() {
    const data = await readFile(/* turbopackIgnore: true */ "/proc/uptime", "utf-8")
    const seconds = parseFloat(data.split(" ")[0] ?? "0")
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    return { days, hours, minutes, totalSeconds: seconds }
  }
}

export const systemMonitor = new SystemMonitor()
