"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Clock } from "lucide-react"
import { OverviewTab } from "./overview-tab"
import { CpuTab } from "./cpu-tab"
import { MemoryTab } from "./memory-tab"
import { DiskTab } from "./disk-tab"
import { ProcessesTab } from "./processes-tab"
import { useSystemMetrics } from "../hooks/use-system-metrics"
import { formatUptime } from "../lib/format"

export function MonitoringView() {
  const { metrics } = useSystemMetrics()
  const uptimeText = metrics
    ? formatUptime(metrics.uptime.days, metrics.uptime.hours, metrics.uptime.minutes)
    : null

  return (
    <Tabs defaultValue="overview">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="cpu">CPU</TabsTrigger>
          <TabsTrigger value="memory">内存</TabsTrigger>
          <TabsTrigger value="disk">磁盘</TabsTrigger>
          <TabsTrigger value="processes">进程</TabsTrigger>
        </TabsList>
        {uptimeText && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>运行时间</span>
            <span className="font-mono font-medium text-foreground">
              {uptimeText}
            </span>
          </div>
        )}
      </div>
      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>
      <TabsContent value="cpu">
        <CpuTab />
      </TabsContent>
      <TabsContent value="memory">
        <MemoryTab />
      </TabsContent>
      <TabsContent value="disk">
        <DiskTab />
      </TabsContent>
      <TabsContent value="processes">
        <ProcessesTab />
      </TabsContent>
    </Tabs>
  )
}
