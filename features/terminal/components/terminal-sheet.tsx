"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function TerminalSheet() {
  const { isOpen, close } = useModalStore()
  const [url, setUrl] = useState("")

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    let cancelled = false

    async function fetchUrl() {
      try {
        // Step 1: Request a short-lived token (credential NOT in response)
        const tokenRes = await fetch("/api/terminal/token", { signal: controller.signal })
        const { url: baseUrl, token } = await tokenRes.json()

        if (cancelled) return

        // Step 2: Exchange the token for the actual auth credential
        const authRes = await fetch("/api/terminal/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        })

        if (cancelled) return

        if (!authRes.ok) {
          setUrl("")
          return
        }

        const { auth } = await authRes.json()

        if (cancelled) return

        // Step 3: Construct the authenticated URL (with null-safety on auth)
        if (!auth) {
          setUrl("")
          return
        }
        const authUrl = baseUrl.replace("://", `://${auth}@`)
        setUrl(authUrl)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setUrl("")
      }
    }
    fetchUrl()
    return () => {
      cancelled = true
      controller.abort()
      setUrl("")
    }
  }, [isOpen])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col" showCloseButton={false}>
        {url ? (
          <iframe src={url} className="flex-1 border-0" title="终端" />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
