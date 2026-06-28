"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function TerminalModal() {
  const { isOpen, close } = useModalStore()
  const [url, setUrl] = useState("")
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setError(false)
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
          setError(true)
          return
        }

        const { auth } = await authRes.json()

        if (cancelled) return

        // Step 3: Construct the authenticated URL (with null-safety on auth)
        if (!auth) {
          setUrl("")
          setError(true)
          return
        }
        const authUrl = baseUrl.replace("://", `://${auth}@`)
        setUrl(authUrl)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setUrl("")
        setError(true)
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent
        className="fixed inset-[3%] max-w-none w-[94%] h-[94%] rounded-xl p-0 flex flex-col gap-0"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>终端</DialogTitle>
        </DialogHeader>
        {url ? (
          <iframe src={url} className="flex-1 border-0" title="终端" />
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium">ttyd 服务未运行或无法访问</p>
            <p className="text-sm text-muted-foreground">请确保 ttyd 已在端口 3001 启动</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
