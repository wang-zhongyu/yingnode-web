import type { InterfaceStatus } from "@/shared/types/network"

export function InterfaceListItem({ name, state, ipv4 }: InterfaceStatus) {
  const stateLabel =
    state === "UP" ? "已连接" : state === "DOWN" ? "未连接" : "未知"

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            state === "UP" ? "bg-green-500" : "bg-muted-foreground/30"
          }`}
        />
        <span className="text-sm font-mono font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground">{stateLabel}</span>
        <span className="text-sm font-mono text-muted-foreground">
          {ipv4 ?? "—"}
        </span>
      </div>
    </div>
  )
}
