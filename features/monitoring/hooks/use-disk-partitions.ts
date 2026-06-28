"use client"

import { usePolling } from "@/shared/hooks/use-polling"

interface Partition {
  filesystem: string
  size: string
  used: string
  available: string
  usePercent: string
  mountedOn: string
}

export function useDiskPartitions() {
  const { data, error, isLoading } = usePolling<{ partitions: Partition[] }>(
    "/api/monitoring/disk",
    0, // ponytail: 0 = no polling, single fetch on mount
  )

  return {
    partitions: data?.partitions ?? [],
    isLoading,
    error,
  }
}
