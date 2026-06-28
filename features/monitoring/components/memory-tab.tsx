"use client"

import { Puzzle } from "lucide-react"
import { MetricCard } from "./metric-card"
import { MetricChart } from "./metric-chart"
import { useMetricsHistory } from "../hooks/use-metrics-history"
import { useProcesses } from "../hooks/use-processes"
import { formatBytes, formatPercentage } from "../lib/format"
import type { SystemMetrics } from "@/shared/types/monitoring"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

function TopMemoryProcesses() {
  const { processes, isLoading, error } = useProcesses("mem", 5)

  if (error) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        无法获取进程信息
      </p>
    )
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />

  if (processes.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>进程名</TableHead>
            <TableHead>PID</TableHead>
            <TableHead>内存</TableHead>
            <TableHead>CPU</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processes.map((p) => (
            <TableRow key={p.pid}>
              <TableCell className="max-w-[200px] truncate font-medium" title={p.name}>{p.name}</TableCell>
              <TableCell>{p.pid}</TableCell>
              <TableCell>{p.mem.toFixed(1)}%</TableCell>
              <TableCell>{p.cpu.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function MemoryTab({ metrics }: { metrics: SystemMetrics | null }) {
  const { records, isLoading: historyLoading } = useMetricsHistory(60)

  if (!metrics) return null

  const memory = metrics?.memory
  const chartData = records.map((r) => {
    const memPercent =
      r.memTotal > 0 ? Math.round((r.memUsed / Number(r.memTotal)) * 100) : 0
    return { timestamp: r.timestamp, value: memPercent }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          icon={Puzzle}
          label="内存使用率"
          primaryValue={
            memory ? formatPercentage(memory.usage) : "--"
          }
          secondaryValue={
            memory
              ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)}`
              : undefined
          }
          usage={memory?.usage}
        />
      </div>
      <MetricChart
        data={chartData}
        label="内存历史趋势"
        color="#f97316"
        isLoading={historyLoading}
      />
      <TopMemoryProcesses />
    </div>
  )
}
