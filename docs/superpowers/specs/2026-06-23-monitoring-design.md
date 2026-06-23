# 系统监控功能设计

> 日期：2026-06-23 | 状态：已批准

## 目标

Dashboard 侧边栏添加"监控"菜单项，页面实时显示 Raspberry Pi 服务器状态。

## 架构

```
app/(dashboard)/monitoring/page.tsx (Server)
  └── MonitoringGrid (Client, 10s 轮询 /api/monitoring)
        └── MetricCard × 5 (纯展示)
```

## 数据源

实时从系统文件读取，不持久化数据库：
- CPU：`/proc/stat`（计算使用率差值）
- 内存：`/proc/meminfo`（MemTotal/MemAvailable）
- 磁盘：`df /` 命令
- 温度：`/sys/class/thermal/thermal_zone0/temp`
- 运行时间：`/proc/uptime`

## 5 个指标卡片

| 指标 | 图标 | 颜色规则 | 显示 |
|------|------|---------|------|
| CPU 使用率 | Cpu | >80% 红，>50% 黄 | 百分比 + 进度条 |
| 内存 | Puzzle | >80% 红，>50% 黄 | 已用/总量 GB + 进度条 |
| 磁盘 | HardDrive | >80% 红，>50% 黄 | 已用/总量 GB + 进度条 |
| CPU 温度 | Thermometer | >70°C 红，>50°C 黄 | °C + 进度条 |
| 运行时间 | Clock | 默认色 | 天/时/分 |

## 文件清单

- `shared/lib/system-monitor.ts` — SystemMonitor 单例
- `shared/types/monitoring.ts` — SystemMetrics 类型
- `app/api/monitoring/route.ts` — GET API
- `features/monitoring/components/monitoring-grid.tsx` — Client 轮询网格
- `features/monitoring/components/metric-card.tsx` — 指标卡片
- `features/monitoring/index.ts` — Barrel
- `app/(dashboard)/monitoring/page.tsx` — 页面
- `features/navigation/components/sidebar-nav-main.tsx` — 加导航项
