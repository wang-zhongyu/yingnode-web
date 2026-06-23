import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  icon: LucideIcon
  label: string
  primaryValue: string
  secondaryValue?: string
  usage?: number // 0-100, undefined means no progress bar
  colorThreshold?: "temp" | "usage" // temp uses celsius thresholds, usage uses percentage
}

function getColor(value: number, threshold: "temp" | "usage"): string {
  const red = threshold === "temp" ? 70 : 80
  const yellow = threshold === "temp" ? 50 : 50

  if (value >= red) return "text-destructive"
  if (value >= yellow) return "text-amber-500"
  return "text-emerald-500"
}

function getProgressColor(value: number, threshold: "temp" | "usage"): string {
  const red = threshold === "temp" ? 70 : 80
  const yellow = threshold === "temp" ? 50 : 50

  if (value >= red) return "bg-destructive"
  if (value >= yellow) return "bg-amber-500"
  return "bg-emerald-500"
}

export function MetricCard({
  icon: Icon,
  label,
  primaryValue,
  secondaryValue,
  usage,
  colorThreshold = "usage",
}: MetricCardProps) {
  const colorClass =
    usage !== undefined ? getColor(usage, colorThreshold) : undefined

  const progressClass =
    usage !== undefined
      ? getProgressColor(usage, colorThreshold)
      : undefined

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("size-4", colorClass)} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={cn("text-2xl font-semibold font-heading", colorClass)}>
            {primaryValue}
          </span>
          {secondaryValue ? (
            <span className="text-xs text-muted-foreground">
              {secondaryValue}
            </span>
          ) : null}
        </div>
        {usage !== undefined ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-500", progressClass)}
              style={{ width: `${Math.min(100, Math.max(0, usage))}%` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
