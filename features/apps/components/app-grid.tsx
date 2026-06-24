"use client"

import { useState, useEffect } from "react"
import { SpinnerEmpty } from "@/shared/components/spinner-empty"
import { ListEmpty } from "@/shared/components/list-empty"
import type { AppWithStatus } from "@/shared/types/app"
import { AppCard } from "./app-card"

export function AppGrid() {
  const [apps, setApps] = useState<AppWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchApps() {
    setLoading(true)
    try {
      const res = await fetch("/api/apps")
      const data = await res.json()
      setApps(data.apps)
    } catch {
      // silently fail — config read from static file
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApps()
  }, [])

  if (loading) return <SpinnerEmpty message="加载应用列表..." />
  if (apps.length === 0) return <ListEmpty message="没有可安装的应用" />

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} onRefresh={fetchApps} />
      ))}
    </div>
  )
}
