// features/monitoring/hooks/use-metrics-history.ts
"use client"

import { useState, useEffect, useCallback } from "react"

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
}

export function useMetricsHistory(
  minutes: number = 60,
): UseMetricsHistoryResult {
  const [records, setRecords] = useState<MetricsRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/monitoring/history?minutes=${minutes}`)
      if (!res.ok) throw new Error("Failed to fetch history")
      const data = await res.json()
      setRecords(data.records)
    } catch {
      setRecords([])
    } finally {
      setIsLoading(false)
    }
  }, [minutes])

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 30_000)
    return () => clearInterval(interval)
  }, [fetchHistory])

  return { records, isLoading }
}
