"use client"

import { Cpu, Puzzle, HardDrive, Thermometer, Clock } from "lucide-react"
import { MetricCard } from "./metric-card"
import { MetricCardSkeleton } from "./metric-card-skeleton"
import { useSystemMetrics } from "../hooks/use-system-metrics"
import { formatBytes, formatPercentage, formatUptime } from "../lib/format"

export function OverviewTab() {
  const { metrics, error, isLoading } = useSystemMetrics()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">无法获取系统指标</p>
      </div>
    )
  }

  if (!metrics) return null

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
        usage={Math.min(temp.celsius, 100)}
        colorThreshold="temp"
      />
      <MetricCard
        icon={Clock}
        label="运行时间"
        primaryValue={formatUptime(uptime.days, uptime.hours, uptime.minutes)}
      />
    </div>
  )
}
