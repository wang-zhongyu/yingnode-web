import type { LucideIcon } from "lucide-react"

interface ListEmptyProps {
  message?: string
  icon?: LucideIcon
  title?: string
  description?: string
}

export function ListEmpty({
  message = "暂无数据",
  icon: Icon,
  title,
  description,
}: ListEmptyProps) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        {Icon ? <Icon className="size-8 text-muted-foreground" /> : null}
        <span className="text-sm text-muted-foreground">
          {title ?? message}
        </span>
        {description ? (
          <p className="text-xs text-muted-foreground/60">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
