import type { AppWithStatus } from "@/shared/types/app"
import { appStore } from "@/shared/lib/app-store"
import { AppGrid } from "@/features/apps/components/app-grid"

export default async function AppsPage() {
  let initialApps: AppWithStatus[] = []
  try {
    initialApps = await appStore.getApps()
  } catch {
    initialApps = []
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">应用管理</h1>
      <AppGrid initialApps={initialApps} />
    </div>
  )
}
