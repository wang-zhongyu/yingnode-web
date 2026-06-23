import { MonitoringGrid } from "@/features/monitoring/components/monitoring-grid"

export default function MonitoringPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">系统监控</h1>
      <MonitoringGrid />
    </div>
  )
}
