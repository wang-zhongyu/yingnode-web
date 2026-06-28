// features/monitoring/hooks/use-system-metrics.ts
"use client"

import { usePolling } from "@/shared/hooks/use-polling"
import type { SystemMetrics } from "@/shared/types/monitoring"

interface UseSystemMetricsResult {
  metrics: SystemMetrics | null
  error: boolean
  isLoading: boolean
}

export function useSystemMetrics(): UseSystemMetricsResult {
  const { data: metrics, error, isLoading } = usePolling<SystemMetrics>(
    "/api/monitoring",
    10_000,
  )

  return { metrics, error, isLoading }
}
