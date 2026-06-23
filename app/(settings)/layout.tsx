import { SidebarProvider } from "@/components/ui/sidebar"
import { SettingsSidebar } from "@/features/navigation/components/settings-sidebar"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <SettingsSidebar />
      <main className="flex-1 p-6 animate-slide-down">{children}</main>
    </SidebarProvider>
  )
}
