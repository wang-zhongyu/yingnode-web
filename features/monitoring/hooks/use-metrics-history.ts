// features/monitoring/hooks/use-metrics-history.ts
"use client"

import { usePolling } from "@/shared/hooks/use-polling"

export interface MetricsRecord {
  timestamp: string
  cpuUsage: number
  memUsed: number
  memTotal: number
  diskUsed: number
  diskTotal: number
  tempCelsius: number
}

interface UseMetricsHistoryResult {
  records: MetricsRecord[]
  isLoading: boolean
  error: boolean
}

export function useMetricsHistory(
  minutes: number = 60,
): UseMetricsHistoryResult {
  const { data, error, isLoading } = usePolling<{ records: MetricsRecord[] }>(
    `/api/monitoring/history?minutes=${minutes}`,
    30_000,
  )

  return { records: data?.records ?? [], error, isLoading }
}
