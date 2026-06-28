"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useContainerLogs } from "@/features/docker/hooks/use-container-logs"

interface Props {
  containerId: string
  open: boolean
  onClose: () => void
}

export function ContainerLogsSheet({ containerId, open, onClose }: Props) {
  const logs = useContainerLogs(containerId, open)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="h-[70vh]" showCloseButton={false}>
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-2">
          <SheetTitle>容器日志</SheetTitle>
        </SheetHeader>
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-green-400 bg-black">
          {logs || "（无日志）"}
        </pre>
      </SheetContent>
    </Sheet>
  )
}
