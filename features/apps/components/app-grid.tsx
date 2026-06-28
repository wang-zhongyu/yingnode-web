"use client"

import { useState } from "react"
import { SpinnerEmpty } from "@/shared/components/spinner-empty"
import { ListEmpty } from "@/shared/components/list-empty"
import { usePolling } from "@/shared/hooks/use-polling"
import type { AppWithStatus } from "@/shared/types/app"
import { AppCard } from "./app-card"

export function AppGrid({ initialApps }: { initialApps: AppWithStatus[] }) {
  const [version, setVersion] = useState(0)
  const { data, isLoading: loading } = usePolling<{ apps: AppWithStatus[] }>(
    `/api/apps?_=${version}`,
    0,
  )

  // ponytail: use server-rendered initial data while client fetch is in flight
  const apps = data?.apps ?? initialApps

  if (loading && apps.length === 0) return <SpinnerEmpty message="加载应用列表..." />
  if (!loading && apps.length === 0) return <ListEmpty message="没有可安装的应用" />

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} onRefresh={() => setVersion((v) => v + 1)} />
      ))}
    </div>
  )
}
