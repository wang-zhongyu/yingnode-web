"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function TerminalSheet() {
  const { isOpen, close } = useModalStore()
  const [url, setUrl] = useState("")

  useEffect(() => {
    if (!isOpen) return
    async function fetchUrl() {
      const res = await fetch("/api/terminal/token")
      const { url } = await res.json()
      setUrl(url)
    }
    fetchUrl()
    return () => setUrl("")
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
