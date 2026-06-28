"use client"

import { useState, useEffect } from "react"

export function useContainerLogs(containerId: string, open: boolean) {
  const [logs, setLogs] = useState("")

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()

    async function fetchLogs() {
      try {
        const res = await fetch(`/api/docker/containers/${containerId}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        setLogs(data.logs ?? "")
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
      }
    }
    fetchLogs()

    return () => controller.abort()
  }, [containerId, open])

  return logs
}
