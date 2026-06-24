import { Spinner } from "@/components/ui/spinner"

interface SpinnerEmptyProps {
  message?: string
}

export function SpinnerEmpty({ message = "加载中..." }: SpinnerEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <Spinner />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  )
}
