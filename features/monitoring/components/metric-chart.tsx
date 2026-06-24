// features/monitoring/components/metric-chart.tsx
"use client"

import { Card, CardHeader, CardContent } from "@/components/ui/card"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { MetricChartSkeleton } from "./metric-chart-skeleton"
import { ListEmpty } from "@/shared/components/list-empty"
import { ChartNoAxesColumn } from "lucide-react"

interface ChartPoint {
  timestamp: string
  value: number
}

interface MetricChartProps {
  data: ChartPoint[]
  label: string
  color: string
  isLoading: boolean
}

function formatTime(ts: unknown): string {
  const date = new Date(ts as string)
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function MetricChart({
  data,
  label,
  color,
  isLoading,
}: MetricChartProps) {
  if (isLoading) return <MetricChartSkeleton />

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>{label}</CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <ListEmpty
              icon={ChartNoAxesColumn}
              title="暂无数据"
              description="采集开始后将显示历史趋势"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>{label}</CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis fontSize={12} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              labelFormatter={formatTime}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#fill-${label})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
