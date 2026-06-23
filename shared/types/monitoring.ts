export interface CpuInfo {
  usage: number // percentage 0-100
}

export interface MemoryInfo {
  total: number // bytes
  used: number
  usage: number // percentage 0-100
}

export interface DiskInfo {
  total: number // bytes
  used: number
  usage: number // percentage 0-100
}

export interface TempInfo {
  celsius: number
}

export interface UptimeInfo {
  days: number
  hours: number
  minutes: number
  totalSeconds: number
}

export interface SystemMetrics {
  cpu: CpuInfo
  memory: MemoryInfo
  disk: DiskInfo
  temp: TempInfo
  uptime: UptimeInfo
}
