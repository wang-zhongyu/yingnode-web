import type { LucideIcon } from "lucide-react"
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

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

function getStatusLabel(
  value: number,
  threshold: "temp" | "usage",
): string {
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
        <Icon />
        <span>{label}</span>
        {statusLabel ? <Badge variant={statusVariant}>{statusLabel}</Badge> : null}
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold font-heading">
          {primaryValue}
        </span>
        {secondaryValue ? (
          <span className="text-xs text-muted-foreground">
            {secondaryValue}
          </span>
        ) : null}
      </CardContent>
      {usage !== undefined ? (
        <CardFooter>
          <Progress value={Math.min(100, Math.max(0, usage))} />
        </CardFooter>
      ) : null}
    </Card>
  )
}
