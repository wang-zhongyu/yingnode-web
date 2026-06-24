"use client"

import { useState, useEffect, useCallback } from "react"

interface UsePollingResult<T> {
  data: T | null
  error: boolean
  isLoading: boolean
}

export function usePolling<T>(
  url: string,
  intervalMs: number,
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed")
      const json = (await res.json()) as T
      setData(json)
      setError(false)
    } catch {
      setError(true)
    }
  }, [url])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed")
        const json = (await res.json()) as T
        if (!cancelled) {
          setData(json)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    poll()
    const interval = setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [url, intervalMs])

  const isLoading = !error && data === null

  return { data, error, isLoading }
}
