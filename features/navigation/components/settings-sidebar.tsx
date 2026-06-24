"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { SettingsNavMain } from "./settings-nav-main"

export function SettingsSidebar() {
  const router = useRouter()

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => router.push("/network")}>
              <ArrowLeft className="size-4" />
              <span>返回</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="pointer-events-none font-medium">
              <Settings className="size-4" />
              <span>设置</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SettingsNavMain />
      </SidebarContent>
    </Sidebar>
  )
}
