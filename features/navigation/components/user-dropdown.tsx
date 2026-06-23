"use client"

import { useSession } from "@/shared/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Settings, LogOut } from "lucide-react"
import { useState } from "react"
import { LogoutAlertDialog } from "@/shared/components/logout-alert-dialog"
import { useRouter } from "next/navigation"

export function UserDropdown() {
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <button {...props} className="cursor-pointer">
              <Avatar size="sm">
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
            </button>
          )}
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>账户</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem className="text-muted-foreground text-xs">
              {email}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={(props) => (
                <button
                  {...props}
                  onClick={() => router.push("/settings/general")}
                >
                  <Settings />
                  <span>设置</span>
                </button>
              )}
            />
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              render={(props) => (
                <button
                  {...props}
                  onClick={() => setLogoutOpen(true)}
                >
                  <LogOut />
                  <span>退出登录</span>
                </button>
              )}
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutAlertDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
      />
    </>
  )
}
