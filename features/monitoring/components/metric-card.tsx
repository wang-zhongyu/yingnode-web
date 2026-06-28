import type { LucideIcon } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface MetricCardProps {
  icon: LucideIcon
  label: string
  primaryValue: string
  secondaryValue?: string
  usage?: number
  colorThreshold?: "temp" | "usage"
}

function getStatusVariant(
  value: number,
  threshold: "temp" | "usage",
): "destructive" | "secondary" | "default" {
  const red = threshold === "temp" ? 70 : 80
  const yellow = threshold === "temp" ? 50 : 50

  if (value >= red) return "destructive"
  if (value >= yellow) return "secondary"
  return "default"
}

function getStatusLabel(value: number, threshold: "temp" | "usage"): string {
  const red = threshold === "temp" ? 70 : 80
  const yellow = threshold === "temp" ? 50 : 50

  if (value >= red) return "高"
  if (value >= yellow) return "中"
  return "正常"
}

export function MetricCard({
  icon: Icon,
  label,
  primaryValue,
  secondaryValue,
  usage,
  colorThreshold = "usage",
}: MetricCardProps) {
  const statusVariant =
    usage !== undefined
      ? getStatusVariant(usage, colorThreshold)
      : "default"

  const statusLabel =
    usage !== undefined
      ? getStatusLabel(usage, colorThreshold)
      : undefined

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon />
          <CardTitle>{label}</CardTitle>
        </div>
        {secondaryValue ? (
          <CardDescription className="truncate">{secondaryValue}</CardDescription>
        ) : null}
        {statusLabel ? (
          <CardAction>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold font-heading">
          {primaryValue}
        </span>
        {usage !== undefined ? (
          <Progress value={Math.min(100, Math.max(0, usage))} />
        ) : null}
      </CardContent>
    </Card>
  )
}
