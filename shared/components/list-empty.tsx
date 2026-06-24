interface ListEmptyProps {
  message?: string
}

export function ListEmpty({ message = "暂无数据" }: ListEmptyProps) {
  return (
    <div className="flex items-center justify-center py-8">
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  )
}
