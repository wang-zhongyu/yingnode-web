"use client"

import { HardDrive } from "lucide-react"
import { MetricCard } from "./metric-card"
import { MetricChart } from "./metric-chart"
import { DiskPartitionTable } from "./disk-partition-table"
import { useMetricsHistory } from "../hooks/use-metrics-history"
import { formatBytes, formatPercentage } from "../lib/format"
import type { SystemMetrics } from "@/shared/types/monitoring"

export function DiskTab({ metrics }: { metrics: SystemMetrics | null }) {
  const { records, isLoading: historyLoading } = useMetricsHistory(60)

  if (!metrics) return null

  const disk = metrics?.disk
  const chartData = records.map((r) => {
    const diskPercent =
      r.diskTotal > 0
        ? Math.round((r.diskUsed / Number(r.diskTotal)) * 100)
        : 0
    return { timestamp: r.timestamp, value: diskPercent }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          icon={HardDrive}
          label="磁盘使用率"
          primaryValue={
            disk ? formatPercentage(disk.usage) : "--"
          }
          secondaryValue={
            disk
              ? `${formatBytes(disk.used)} / ${formatBytes(disk.total)}`
              : undefined
          }
          usage={disk?.usage}
        />
      </div>
      <MetricChart
        data={chartData}
        label="磁盘历史趋势"
        color="#22c55e"
        isLoading={historyLoading}
      />
      <DiskPartitionTable />
    </div>
  )
}
