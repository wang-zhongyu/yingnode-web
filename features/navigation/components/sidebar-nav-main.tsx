"use client"

import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { Settings, Activity } from "lucide-react"

const navItems = [
  { label: "系统监控", href: "/monitoring", icon: Activity },
  { label: "设置", href: "/settings/general", icon: Settings },
]

export function SidebarNavMain() {
  const pathname = usePathname()
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => (
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
