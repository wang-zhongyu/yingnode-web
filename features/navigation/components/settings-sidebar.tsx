import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { SettingsNavMain } from "./settings-nav-main"
import { SidebarUser } from "./sidebar-user"
import { Radio } from "lucide-react"

export function SettingsSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Radio className="size-5" />
          <span>YingNode</span>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SettingsNavMain />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>
    </Sidebar>
  )
}
