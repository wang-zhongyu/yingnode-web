"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import type { AppWithStatus } from "@/shared/types/app"
import { Cloud, Server, Globe, Container, Home, Download } from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  cloud: Cloud,
  server: Server,
  globe: Globe,
  container: Container,
  home: Home,
}

interface Props {
  app: AppWithStatus
  onRefresh: () => void
}

export function AppCard({ app, onRefresh }: Props) {
  const [acting, setActing] = useState(false)
  const Icon = iconMap[app.icon] ?? Download

  async function handleAction(action: "install" | "uninstall") {
    setActing(true)
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, action }),
      })
      const data = await res.json()
      if (data.success) {
        const label = action === "install" ? "安装" : "卸载"
        toast.success(`${label}成功`)
        onRefresh()
      } else {
        const label = action === "install" ? "安装" : "卸载"
        const detail = data.output ? `\n${data.output.slice(-500)}` : ""
        toast.error(`${label}失败${detail}`, { duration: 10000 })
      }
    } catch {
      toast.error("操作失败")
    } finally {
      setActing(false)
    }
  }

  function renderActionButton() {
    if (app.installed) {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={acting || !app.uninstall}
          onClick={() => handleAction("uninstall")}
        >
          {acting && <Spinner data-icon="inline-start" />}
          卸载
        </Button>
      )
    }

    return (
      <Button size="sm" disabled={acting} onClick={() => handleAction("install")}>
        {acting && <Spinner data-icon="inline-start" />}
        安装
      </Button>
    )
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-muted-foreground" />
          <span className="font-medium">{app.name}</span>
        </div>
        {app.installed ? (
          <Badge variant="default">已安装</Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{app.description}</p>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{app.category}</span>
        {renderActionButton()}
      </div>
      </div>
    </Card>
  )
}
