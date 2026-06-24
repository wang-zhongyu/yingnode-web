// features/monitoring/hooks/use-system-metrics.ts
"use client"

import { useState, useEffect, useCallback } from "react"
import type { SystemMetrics } from "@/shared/types/monitoring"

interface UseSystemMetricsResult {
  metrics: SystemMetrics | null
  error: boolean
  isLoading: boolean
}

export function useSystemMetrics(): UseSystemMetricsResult {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [error, setError] = useState(false)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = (await res.json()) as SystemMetrics
      setMetrics(data)
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10_000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const isLoading = !error && metrics === null

  return { metrics, error, isLoading }
}
