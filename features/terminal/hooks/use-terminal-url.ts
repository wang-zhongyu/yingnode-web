"use client"

import { useEffect, useState } from "react"
import type { ModalType } from "@/shared/stores/use-modal-store"

export function useTerminalUrl(isOpen: boolean, type: ModalType | null) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isOpen || type !== "terminal") return
    const controller = new AbortController()

    async function fetchUrl() {
      setUrl(null)
      setError(false)
      try {
        const tokenRes = await fetch("/api/terminal/token", {
          signal: controller.signal,
        })
        const { url: baseUrl, token } = await tokenRes.json()

        const authRes = await fetch("/api/terminal/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        })

        if (!authRes.ok) {
          setUrl(null)
          setError(true)
          return
        }

        const { auth } = await authRes.json()

        if (!auth) {
          setUrl(null)
          setError(true)
          return
        }
        const authUrl = baseUrl.replace("://", `://${auth}@`)
        setUrl(authUrl)
        setError(false)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setUrl(null)
        setError(true)
      }
    }
    fetchUrl()

    return () => controller.abort()
  }, [isOpen, type])

  return { url, error }
}
