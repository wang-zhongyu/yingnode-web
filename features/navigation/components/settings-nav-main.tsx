"use client"

import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Settings, Wifi } from "lucide-react"

const settingsNavItems = [
  { label: "通用设置", href: "/settings/general", icon: Settings },
  { label: "网络设置", href: "/settings/network", icon: Wifi },
]

export function SettingsNavMain() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>设置</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {settingsNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={false}
                render={(props) => (
                  <Link href={item.href} {...props}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
