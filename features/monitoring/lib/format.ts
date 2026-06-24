// features/monitoring/lib/format.ts

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 GB"

  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB`
}

export function formatPercentage(value: number): string {
  return `${value}%`
}

export function formatUptime(
  days: number,
  hours: number,
  minutes: number,
): string {
  if (days > 0) {
    return `${days} 天 ${hours} 时`
  }
  if (hours > 0) {
    return `${hours} 时 ${minutes} 分`
  }
  return `${minutes} 分`
}
