"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SpinnerEmpty } from "@/shared/components/spinner-empty"
import { ListEmpty } from "@/shared/components/list-empty"
import { usePolling } from "@/shared/hooks/use-polling"
import type { DockerContainer, ContainerAction } from "@/shared/types/docker"
import { ContainerLogsSheet } from "./container-logs-sheet"
import { PlayIcon, SquareIcon, RotateCwIcon, FileTextIcon } from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

const STATE_LABELS: Record<string, string> = {
  running: "运行中",
  stopped: "已停止",
  paused: "已暂停",
  restarting: "重启中",
}

function stateVariant(state: string): "default" | "secondary" {
  return state === "running" ? "default" : "secondary"
}

export function ContainerList({
  initialContainers,
  initialDockerAvailable,
}: {
  initialContainers: DockerContainer[]
  initialDockerAvailable: boolean
}) {
  const [version, setVersion] = useState(0)
  const { data, isLoading: loading } = usePolling<{
    containers: DockerContainer[]
    dockerAvailable: boolean
  }>(`/api/docker/containers?_=${version}`, 0)
  const [logsId, setLogsId] = useState<string | null>(null)

  // ponytail: use server-rendered initial data while client fetch is in flight
  const containers = data?.containers ?? initialContainers
  const dockerAvailable = data?.dockerAvailable ?? initialDockerAvailable

  async function handleAction(id: string, action: ContainerAction) {
    try {
      const res = await fetch(`/api/docker/containers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Failed")
      const labels: Record<ContainerAction, string> = {
        start: "启动",
        stop: "停止",
        restart: "重启",
      }
      toast.success(`容器已${labels[action]}`)
      setVersion((v) => v + 1)
    } catch {
      toast.error("操作失败")
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>镜像</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>端口</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {containers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><span className="font-medium">{c.name}</span></TableCell>
                  <TableCell><span className="text-muted-foreground text-xs">{c.image}</span></TableCell>
                  <TableCell>
                    <Badge variant={stateVariant(c.state)}>
                      {STATE_LABELS[c.state] ?? c.state}
                    </Badge>
                  </TableCell>
                  <TableCell><span className="text-muted-foreground font-mono text-xs">{c.ports || "-"}</span></TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
