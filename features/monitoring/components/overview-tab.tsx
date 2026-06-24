"use client"

import { Cpu, Puzzle, HardDrive, Thermometer } from "lucide-react"
import { MetricCard } from "./metric-card"
import { MetricCardSkeleton } from "./metric-card-skeleton"
import { formatBytes, formatPercentage } from "../lib/format"
import type { SystemMetrics } from "@/shared/types/monitoring"

interface OverviewTabProps {
  metrics: SystemMetrics | null
  error: boolean
}

export function OverviewTab({ metrics, error }: OverviewTabProps) {
  if (!metrics && !error) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">无法获取系统指标</p>
      </div>
    )
  }

  const { cpu, memory, disk, temp } = metrics

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
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
    </div>
  )
}
