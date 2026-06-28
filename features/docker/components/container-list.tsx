"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SpinnerEmpty } from "@/shared/components/spinner-empty"
import { ListEmpty } from "@/shared/components/list-empty"
import type { DockerContainer, ContainerAction } from "@/shared/types/docker"
import { ContainerLogsSheet } from "./container-logs-sheet"
import { PlayIcon, SquareIcon, RotateCwIcon, FileTextIcon } from "lucide-react"

const STATE_LABELS: Record<string, string> = {
  running: "运行中",
  stopped: "已停止",
  paused: "已暂停",
  restarting: "重启中",
}

export function ContainerList({
  initialContainers,
  initialDockerAvailable,
}: {
  initialContainers: DockerContainer[]
  initialDockerAvailable: boolean
}) {
  const [containers, setContainers] = useState<DockerContainer[]>(initialContainers)
  const [loading, setLoading] = useState(false)
  const [dockerAvailable, setDockerAvailable] = useState(initialDockerAvailable)
  const [logsId, setLogsId] = useState<string | null>(null)

  async function fetchContainers() {
    setLoading(true)
    try {
      const res = await fetch("/api/docker/containers")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setContainers(data.containers)
      setDockerAvailable(data.dockerAvailable !== false)
    } catch {
      toast.error("无法获取 Docker 容器列表")
      setDockerAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(id: string, action: ContainerAction) {
    try {
      const res = await fetch(`/api/docker/containers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Failed")
      const labels: Record<ContainerAction, string> = { start: "启动", stop: "停止", restart: "重启" }
      toast.success(`容器已${labels[action]}`)
      fetchContainers()
    } catch {
      toast.error(`操作失败`)
    }
  }

  if (loading && containers.length === 0) return <SpinnerEmpty message="加载容器列表..." />

  if (!dockerAvailable) {
    return <ListEmpty message="Docker 不可用，请确保 Docker 已安装并启动" />
  }

  if (containers.length === 0) return <ListEmpty message="没有 Docker 容器" />

  return (
    <>
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">名称</th>
                <th className="px-4 py-3 text-left font-medium">镜像</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">端口</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.image}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={c.state === "running" ? "default" : "secondary"}
                    >
                      {STATE_LABELS[c.state] ?? c.state}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {c.ports || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {c.state === "running" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleAction(c.id, "stop")}
                          title="停止"
                        >
                          <SquareIcon className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleAction(c.id, "start")}
                          title="启动"
                        >
                          <PlayIcon className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleAction(c.id, "restart")}
                        disabled={c.state !== "running"}
                        title="重启"
                      >
                        <RotateCwIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLogsId(c.id)}
                        title="日志"
                      >
                        <FileTextIcon className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ContainerLogsSheet
        containerId={logsId ?? ""}
        open={logsId !== null}
        onClose={() => setLogsId(null)}
      />
    </>
  )
}
