"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => router.push("/monitoring")}>
              <ArrowLeft className="size-4" />
              <span>返回</span>
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
