"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { OverviewTab } from "./overview-tab"
import { CpuTab } from "./cpu-tab"
import { MemoryTab } from "./memory-tab"
import { DiskTab } from "./disk-tab"
import { ProcessesTab } from "./processes-tab"

export function MonitoringView() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="cpu">CPU</TabsTrigger>
        <TabsTrigger value="memory">内存</TabsTrigger>
        <TabsTrigger value="disk">磁盘</TabsTrigger>
        <TabsTrigger value="processes">进程</TabsTrigger>
      </TabsList>
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
