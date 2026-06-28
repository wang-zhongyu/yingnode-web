// features/monitoring/lib/format.ts

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"

  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`

  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`

  const kb = bytes / 1024
  return `${kb.toFixed(1)} KB`
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
    return `${days} 天 ${hours} 时 ${minutes} 分`
  }
  if (hours > 0) {
    return `${hours} 时 ${minutes} 分`
  }
  return `${minutes} 分`
}
