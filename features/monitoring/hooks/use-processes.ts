// features/monitoring/hooks/use-processes.ts
"use client"

import { usePolling } from "@/shared/hooks/use-polling"
import type { ProcessInfo } from "@/shared/types/monitoring"

interface UseProcessesResult {
  processes: ProcessInfo[]
  isLoading: boolean
  error: boolean
}

export function useProcesses(
  sort: "cpu" | "mem" = "cpu",
  limit: number = 50,
): UseProcessesResult {
  const { data, error, isLoading } = usePolling<{ processes: ProcessInfo[] }>(
    `/api/monitoring/processes?sort=${sort}&limit=${limit}`,
    10_000,
  )

  return { processes: data?.processes ?? [], error, isLoading }
}
