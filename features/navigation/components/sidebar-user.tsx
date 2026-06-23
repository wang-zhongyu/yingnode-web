"use client"

import { useSession } from "@/shared/lib/auth-client"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { LogOut } from "lucide-react"
import { useState } from "react"
import { LogoutAlertDialog } from "@/shared/components/logout-alert-dialog"
import { useRouter } from "next/navigation"

export function SidebarUser() {
  const { data: session } = useSession()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const router = useRouter()

  if (!session) {
    return null
  }

  const email = session.user?.email ?? ""
  const initial = email.charAt(0).toUpperCase()

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            render={(props) => (
              <button
                {...props}
                onClick={() => router.push("/settings/general")}
              >
                <Avatar size="sm">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left text-sm leading-tight">
                  <span className="truncate font-medium">{email}</span>
                </div>
              </button>
            )}
          />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={(props) => (
              <button
                {...props}
                className="text-muted-foreground"
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut />
                <span>退出登录</span>
              </button>
            )}
          />
        </SidebarMenuItem>
      </SidebarMenu>
      <LogoutAlertDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
      />
    </>
  )
}
