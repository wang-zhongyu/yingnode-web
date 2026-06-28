"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function TerminalModal() {
  const { type, isOpen, close } = useModalStore()
  const [url, setUrl] = useState("")
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isOpen || type !== "terminal") return
    const controller = new AbortController()

    async function fetchUrl() {
      setUrl("")
      setError(false)
      try {
        const tokenRes = await fetch("/api/terminal/token", { signal: controller.signal })
        const { url: baseUrl, token } = await tokenRes.json()

        const authRes = await fetch("/api/terminal/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        })

        if (!authRes.ok) {
          setUrl("")
          setError(true)
          return
        }

        const { auth } = await authRes.json()

        if (!auth) {
          setUrl("")
          setError(true)
          return
        }
        const authUrl = baseUrl.replace("://", `://${auth}@`)
        setUrl(authUrl)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setUrl("")
        setError(true)
      }
    }
    fetchUrl()
    return () => controller.abort()
  }, [isOpen, type])

  if (type !== "terminal") return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent
        className="inset-[3%] max-w-none w-[94%] h-[94%] translate-x-0 translate-y-0 p-0 flex flex-col gap-0"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>终端</DialogTitle>
        </DialogHeader>
        <TerminalBody url={url} error={error} />
      </DialogContent>
    </Dialog>
  )
}

function TerminalBody({ url, error }: { url: string; error: boolean }) {
  if (url) {
    return <iframe src={url} className="flex-1 border-0" title="终端" sandbox="allow-same-origin allow-scripts" />
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium">ttyd 服务未运行或无法访问</p>
        <p className="text-sm text-muted-foreground">
          请确保 ttyd 已在端口 3001 启动
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      加载中...
    </div>
  )
}
