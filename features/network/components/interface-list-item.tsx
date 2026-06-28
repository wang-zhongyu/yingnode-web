import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { InterfaceStatus } from "@/shared/types/network"

const STATE_LABELS: Record<string, string> = {
  UP: "已连接",
  DOWN: "未连接",
  UNKNOWN: "未知",
}

export function InterfaceListItem({ name, state, ipv4s }: InterfaceStatus) {
  const stateLabel = STATE_LABELS[state] ?? "未知"

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-2.5 rounded-full",
            state === "UP" ? "bg-green-500" : "bg-muted-foreground/30",
          )}
        />
        <span className="text-sm font-mono font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant={state === "UP" ? "default" : "secondary"} className="text-xs">
          {stateLabel}
        </Badge>
        <span className="text-sm font-mono text-muted-foreground">
          {ipv4s.length > 0 ? ipv4s.join(", ") : "—"}
        </span>
      </div>
    </div>
  )
}
