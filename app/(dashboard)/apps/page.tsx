import { AppGrid } from "@/features/apps/components/app-grid"

export default function AppsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">应用管理</h1>
      <AppGrid />
    </div>
  )
}
