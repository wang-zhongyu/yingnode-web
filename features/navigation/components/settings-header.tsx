"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { PanelLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SettingsHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger>
        <Button variant="ghost" size="icon">
          <PanelLeftIcon className="size-5" />
        </Button>
      </SidebarTrigger>
    </header>
  )
}
