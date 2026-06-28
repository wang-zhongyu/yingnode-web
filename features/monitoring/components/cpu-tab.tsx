"use client"

import { Cpu } from "lucide-react"
import { MetricCard } from "./metric-card"
import { MetricChart } from "./metric-chart"
import { ListEmpty } from "@/shared/components/list-empty"
import { useMetricsHistory } from "../hooks/use-metrics-history"
import { useProcesses } from "../hooks/use-processes"
import { formatPercentage } from "../lib/format"
import type { SystemMetrics } from "@/shared/types/monitoring"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function TopCpuProcesses() {
  const { processes, isLoading, error } = useProcesses("cpu", 5)

  if (error) return <ListEmpty message="无法获取进程信息" />

  if (isLoading) return <Skeleton className="h-48 w-full" />

  if (processes.length === 0) return <ListEmpty message="暂无进程数据" />

  return (
    <Card>
      <CardContent>
        <div className="pt-6">
        <div className="overflow-x-auto">
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
                  <TableCell className="max-w-[200px]" title={p.name}><span className="truncate font-medium">{p.name}</span></TableCell>
                  <TableCell>{p.pid}</TableCell>
                  <TableCell>{p.cpu.toFixed(1)}%</TableCell>
                  <TableCell>{p.mem.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CpuTab({ metrics }: { metrics: SystemMetrics | null }) {
  const { records, isLoading: historyLoading } = useMetricsHistory(60)

  const cpu = metrics?.cpu
  const chartData = records.map((r) => ({
    timestamp: r.timestamp,
    value: r.cpuUsage,
  }))

  if (!metrics) return <Skeleton className="h-96 w-full" />

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
