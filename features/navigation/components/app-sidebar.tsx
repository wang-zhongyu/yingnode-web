import {
  Sidebar,
  SidebarContent,
  SidebarSeparator,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { SidebarNavMain } from "./sidebar-nav-main"
import { SidebarUser } from "./sidebar-user"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent className="mt-3">
        <SidebarNavMain />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>
    </Sidebar>
  )
}
