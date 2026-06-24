"use client"

import { useState, useEffect, useCallback } from "react"

interface Partition {
  filesystem: string
  size: string
  used: string
  available: string
  usePercent: string
  mountedOn: string
}

type State =
  | { status: "loading" }
  | { status: "loaded"; partitions: Partition[] }
  | { status: "error" }

export function useDiskPartitions() {
  const [state, setState] = useState<State>({ status: "loading" })

  const fetchPartitions = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/disk")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setState({ status: "loaded", partitions: data.partitions })
    } catch {
      setState({ status: "error" })
    }
  }, [])

  useEffect(() => {
    fetchPartitions()
  }, [fetchPartitions])

  return {
    partitions: state.status === "loaded" ? state.partitions : [],
    isLoading: state.status === "loading",
    error: state.status === "error",
  }
}
