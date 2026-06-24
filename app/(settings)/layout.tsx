import { SidebarProvider } from "@/components/ui/sidebar"
import { SettingsSidebar } from "@/features/navigation/components/settings-sidebar"
import { SettingsHeader } from "@/features/navigation/components/settings-header"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <SettingsSidebar />
      <div className="flex flex-1 flex-col">
        <SettingsHeader />
        <main className="flex-1 p-6 animate-slide-down">{children}</main>
      </div>
    </SidebarProvider>
  )
}
