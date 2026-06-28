"use client"

import { useState, useEffect } from "react"

interface UsePollingResult<T> {
  data: T | null
  error: boolean
  isLoading: boolean
}

/** Generic polling hook — single shared primitive for all client-side data fetching.
 *  Set intervalMs to 0 for a one-time fetch (no polling).
 *
 *  ponytail: useEffect is used here because this implements a subscription-style
 *  polling pattern — synchronizing with an external fetch stream over time.
 *  This is the canonical use case for useEffect (external system sync), not a
 *  one-time data fetch that should live in a Server Component. */
export function usePolling<T>(
  url: string,
  intervalMs: number,
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(url)
        if (!cancelled) {
          if (!res.ok) throw new Error("Failed")
          const json = (await res.json()) as T
          setData(json)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    poll()

    if (intervalMs <= 0) return

    const interval = setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [url, intervalMs])

  const isLoading = !error && data === null

  return { data, error, isLoading }
}
