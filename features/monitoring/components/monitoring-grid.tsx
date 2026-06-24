"use client"

import { useEffect, useState } from "react"
import { Cpu, Puzzle, HardDrive, Thermometer, Clock } from "lucide-react"
import { MetricCard } from "./metric-card"
import { Spinner } from "@/components/ui/spinner"
import type { SystemMetrics } from "@/shared/types/monitoring"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 GB"
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB`
}

function formatPercentage(usage: number): string {
  return `${usage}%`
}

function formatUptime(
  days: number,
  hours: number,
  minutes: number,
): string {
  if (days > 0) {
    return `${days} 天`
  }
  if (hours > 0) {
    return `${hours} 时 ${minutes} 分`
  }
  return `${minutes} 分`
}

export function MonitoringGrid() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/monitoring")
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        setMetrics(data)
        setError(false)
      } catch {
        setError(true)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10_000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">无法获取系统指标</p>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  const { cpu, memory, disk, temp, uptime } = metrics

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        icon={Cpu}
        label="CPU 使用率"
        primaryValue={formatPercentage(cpu.usage)}
        usage={cpu.usage}
      />
      <MetricCard
        icon={Puzzle}
        label="内存"
        primaryValue={formatPercentage(memory.usage)}
        secondaryValue={`${formatBytes(memory.used)} / ${formatBytes(memory.total)}`}
        usage={memory.usage}
      />
      <MetricCard
        icon={HardDrive}
        label="磁盘"
        primaryValue={formatPercentage(disk.usage)}
        secondaryValue={`${formatBytes(disk.used)} / ${formatBytes(disk.total)}`}
        usage={disk.usage}
      />
      <MetricCard
        icon={Thermometer}
        label="CPU 温度"
        primaryValue={`${temp.celsius}°C`}
        usage={temp.celsius}
        colorThreshold="temp"
      />
      <MetricCard
        icon={Clock}
        label="运行时间"
        primaryValue={formatUptime(uptime.days, uptime.hours, uptime.minutes)}
        secondaryValue={`${uptime.days > 0 ? `${uptime.days} 天 ${uptime.hours} 时` : uptime.hours > 0 ? `${uptime.hours} 时 ${uptime.minutes} 分` : `${uptime.minutes} 分`}`}
      />
    </div>
  )
}
