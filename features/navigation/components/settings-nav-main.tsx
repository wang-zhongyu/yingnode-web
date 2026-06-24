"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Settings, User, Wifi } from "lucide-react"

const settingsNavItems = [
  { label: "账号设置", href: "/settings/account", icon: User },
  { label: "通用设置", href: "/settings/general", icon: Settings },
  { label: "网络设置", href: "/settings/network", icon: Wifi },
]

export function SettingsNavMain() {
  const pathname = usePathname()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>设置</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {settingsNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname.startsWith(item.href)}
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
