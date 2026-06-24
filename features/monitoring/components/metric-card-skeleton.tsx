// features/monitoring/components/metric-card-skeleton.tsx
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-2 w-full" />
      </CardFooter>
    </Card>
  )
}
