// features/monitoring/hooks/use-processes.ts
"use client"

import { useState, useEffect, useCallback } from "react"

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  mem: number
  user: string
}

interface UseProcessesResult {
  processes: ProcessInfo[]
  isLoading: boolean
  error: boolean
}

type State =
  | { status: "loading" }
  | { status: "loaded"; processes: ProcessInfo[] }
  | { status: "error" }

export function useProcesses(
  sort: "cpu" | "mem" = "cpu",
  limit: number = 50,
): UseProcessesResult {
  const [state, setState] = useState<State>({ status: "loading" })

  const fetchProcesses = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/monitoring/processes?sort=${sort}&limit=${limit}`,
      )
      if (!res.ok) throw new Error("Failed to fetch processes")
      const data = await res.json()
      setState({ status: "loaded", processes: data.processes })
    } catch {
      setState({ status: "error" })
    }
  }, [sort, limit])

  useEffect(() => {
    fetchProcesses()
    const interval = setInterval(fetchProcesses, 10_000)
    return () => clearInterval(interval)
  }, [fetchProcesses])

  const isLoading = state.status === "loading"
  const error = state.status === "error"
  const processes = state.status === "loaded" ? state.processes : []

  return { processes, isLoading, error }
}
