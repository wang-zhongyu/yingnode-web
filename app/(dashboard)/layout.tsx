import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/features/navigation/components/app-sidebar"
import { AppHeader } from "@/features/navigation/components/app-header"
import { NetworkManagerButton } from "@/features/network/components/network-manager-button"
import { TerminalButton } from "@/features/terminal/components/terminal-button"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppHeader actions={<><NetworkManagerButton /><TerminalButton /></>} />
        <main className="flex-1 p-6 animate-slide-down">{children}</main>
      </div>
    </SidebarProvider>
  )
}
