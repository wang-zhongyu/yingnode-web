"use client"

import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Wifi, Settings, Activity } from "lucide-react"

const navItems = [
  { label: "网络管理", href: "/network", icon: Wifi },
  { label: "系统监控", href: "/monitoring", icon: Activity },
  { label: "设置", href: "/settings/general", icon: Settings },
]

export function SidebarNavMain() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
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
