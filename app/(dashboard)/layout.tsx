import { SidebarProvider, Sidebar, SidebarBody, SidebarItem, SidebarLabel } from "@/components/ui/sidebar"
import { Wifi } from "lucide-react"

const navItems = [
  { label: "网络管理", href: "/network", icon: Wifi },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarBody>
          {navItems.map((item) => (
            <SidebarItem key={item.href} href={item.href}>
              <item.icon />
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 p-6">{children}</main>
    </SidebarProvider>
  )
}
