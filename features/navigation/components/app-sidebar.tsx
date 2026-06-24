import {
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar"
import { SidebarNavMain } from "./sidebar-nav-main"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent className="mt-3">
        <SidebarNavMain />
      </SidebarContent>
    </Sidebar>
  )
}
