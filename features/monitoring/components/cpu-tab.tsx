"use client"

import { Cpu } from "lucide-react"
import { MetricCard } from "./metric-card"
import { MetricChart } from "./metric-chart"
import { useSystemMetrics } from "../hooks/use-system-metrics"
import { useMetricsHistory } from "../hooks/use-metrics-history"
import { useProcesses } from "../hooks/use-processes"
import { formatPercentage } from "../lib/format"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

function TopCpuProcesses() {
  const { processes, isLoading, error } = useProcesses("cpu", 5)

  if (error) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        无法获取进程信息
      </p>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  if (processes.length === 0) return null

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>进程名</TableHead>
          <TableHead>PID</TableHead>
          <TableHead>CPU</TableHead>
          <TableHead>内存</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {processes.map((p) => (
          <TableRow key={p.pid}>
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell>{p.pid}</TableCell>
            <TableCell>{p.cpu.toFixed(1)}%</TableCell>
            <TableCell>{p.mem.toFixed(1)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function CpuTab() {
  const { metrics, isLoading } = useSystemMetrics()
  const { records, isLoading: historyLoading } = useMetricsHistory(60)

  const cpu = metrics?.cpu
  const chartData = records.map((r) => ({
    timestamp: r.timestamp,
    value: r.cpuUsage,
  }))

  if (isLoading) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          icon={Cpu}
          label="CPU 使用率"
          primaryValue={cpu ? formatPercentage(cpu.usage) : "--"}
          usage={cpu?.usage}
        />
      </div>
      <MetricChart
        data={chartData}
        label="CPU 历史趋势"
        color="#3b82f6"
        isLoading={historyLoading}
      />
      <TopCpuProcesses />
    </div>
  )
}
