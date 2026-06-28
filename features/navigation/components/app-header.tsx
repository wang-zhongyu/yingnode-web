"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserDropdown } from "./user-dropdown"
import { ThemeToggle } from "./theme-toggle"
import { PanelLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ReactNode } from "react"

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger>
        <Button variant="ghost" size="icon">
          <PanelLeftIcon className="size-5" />
        </Button>
      </SidebarTrigger>
      <div className="flex flex-1 items-center justify-end gap-2">
        {actions}
        <ThemeToggle />
        <UserDropdown />
      </div>
    </header>
  )
}
