"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { useTerminalUrl } from "@/features/terminal/hooks/use-terminal-url"

export function TerminalModal() {
  const { type, isOpen, close } = useModalStore()
  const { url, error } = useTerminalUrl(isOpen, type)

  if (type !== "terminal") return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent
        className="inset-[3%] max-w-none w-[94%] h-[94%] translate-x-0 translate-y-0 flex flex-col"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>终端</DialogTitle>
          <DialogDescription>嵌入式终端会话</DialogDescription>
        </DialogHeader>
        <TerminalBody url={url} error={error} />
      </DialogContent>
    </Dialog>
  )
}

function TerminalBody({ url, error }: { url: string | null; error: boolean }) {
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
