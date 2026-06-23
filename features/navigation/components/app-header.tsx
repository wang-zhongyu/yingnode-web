"use client"

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { UserDropdown } from "./user-dropdown"
import { PanelLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ReactNode } from "react"

export function AppHeader({ actions }: { actions?: ReactNode }) {
  const { isMobile } = useSidebar()

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      {isMobile ? (
        <SidebarTrigger>
          <Button variant="ghost" size="icon">
            <PanelLeftIcon className="size-5" />
          </Button>
        </SidebarTrigger>
      ) : null}
      <div className="flex flex-1 items-center justify-end gap-2">
        {actions}
        <Separator orientation="vertical" className="h-6" />
        <UserDropdown />
      </div>
    </header>
  )
}
