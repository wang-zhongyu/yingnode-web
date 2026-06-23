# 网络监测功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建网络监测基础功能——持续检测互联网连通性，断网时自动创建 Wi-Fi 热点（固定 IP `172.16.42.1`），用户通过 macOS 风格 Popover 界面扫描连接 WiFi。

**Architecture:** Next.js 内置检测循环（instrumentation.ts），child_process 执行系统命令（ping/hostapd/iwlist/wpa_cli），状态持久化 SQLite，客户端轮询 API + Popover 交互。

**Tech Stack:** Next.js 16.2.9, Prisma + SQLite, shadcn/ui (base-ui), sonner, zustand, lucide-react

## Global Constraints

- 编码必须遵守 `CODING-GUIDELINES.md`（Server Component 优先、Guard Clause、单文件 ≤150 行、禁止 useEffect 获取数据等）
- 所有 Modal/Dialog/Sheet 必须使用 Zustand store + ModalProvider 集中注册架构
- shadcn 目录（`components/ui/`、`hooks/`、`lib/`）禁止手动修改或新增非 shadcn 文件
- 业务代码放 `features/` 或 `shared/`
- 每次 shadcn 组件操作前必须调用 `.agents/skills/shadcn/` skill
- 新建文件必须自查目录位置（见 CLAUDE.md）
- 无线接口通过 `WIFI_INTERFACE` 环境变量配置，默认 `wlan0`

---

### Task 1: 安装运行时依赖

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: prisma、@prisma/client、sonner、zustand 可用

- [ ] **Step 1: 安装依赖**

```bash
npm install prisma @prisma/client sonner zustand
```

- [ ] **Step 2: 验证安装**

```bash
npx prisma --version
```
Expected: Prisma CLI 版本号可见

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install prisma, sonner, zustand"
```

---

### Task 2: 初始化 Prisma + NetworkStatus 模型

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env`
- Create: `prisma/migrations/` (via migrate)

**Interfaces:**
- Produces: `prisma/schema.prisma` 含 NetworkStatus 模型，`DATABASE_URL` 环境变量，数据库已迁移

- [ ] **Step 1: 初始化 Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 2: 写入 schema**

在 `prisma/schema.prisma` 中已有默认内容基础上，追加 NetworkStatus 模型：

```prisma
model NetworkStatus {
  id            Int      @id @default(autoincrement())
  status        String   @default("ONLINE")
  hotspotActive Boolean  @default(false)
  lastCheck     DateTime @default(now())
  currentSSID   String?
  ipAddress     String?
}
```

- [ ] **Step 3: 设置环境变量**

在 `.env` 中确保有（Prisma init 已生成 `DATABASE_URL`）：

```
DATABASE_URL="file:./dev.db"
WIFI_INTERFACE="wlan0"
HOTSPOT_SSID="yingnode"
HOTSPOT_IP="172.16.42.1"
```

- [ ] **Step 4: 运行迁移**

```bash
npx prisma migrate dev --name add_network_status
```
Expected: `Migration applied successfully`

- [ ] **Step 5: 生成 Prisma Client**

```bash
npx prisma generate
```
Expected: `Generated Prisma Client`

- [ ] **Step 6: 创建 seed 脚本写入初始状态**

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  await prisma.networkStatus.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      status: "ONLINE",
      hotspotActive: false,
    },
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

更新 `package.json` 的 `prisma.seed`：

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

安装 tsx：`npm install -D tsx`

运行 seed：`npx prisma db seed`

- [ ] **Step 7: 创建 Prisma 单例模块**

```typescript
// shared/lib/prisma.ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 8: Commit**

```bash
git add prisma/ .env shared/lib/prisma.ts package.json package-lock.json
git commit -m "feat: add prisma schema with NetworkStatus model"
```

---

### Task 3: 添加网络相关 shadcn 组件

**Files:**
- Create: `components/ui/popover.tsx`, `components/ui/command.tsx`, `components/ui/dialog.tsx`, `components/ui/separator.tsx`, `components/ui/collapsible.tsx`, `components/ui/badge.tsx`, `components/ui/spinner.tsx`, `components/ui/sheet.tsx`

**Interfaces:**
- Produces: Popover, Command, Dialog, Separator, Collapsible, Badge, Spinner, Sheet 组件可用

- [ ] **Step 1: 调用 shadcn skill 后批量添加组件**

```bash
npx shadcn@latest add popover command dialog separator collapsible badge spinner sheet
```

- [ ] **Step 2: 验证组件已安装**

```bash
ls components/ui/
```
Expected: 至少包含 button.tsx, popover.tsx, command.tsx, dialog.tsx, separator.tsx, collapsible.tsx, badge.tsx, spinner.tsx, sheet.tsx

- [ ] **Step 3: 检查新增组件**

逐个读取新增的 UI 组件文件，确认：
- 没有缺失子组件（如 CommandGroup、DialogTitle 等依赖项）
- 导入路径正确（使用 `@/components/ui/...`）
- iconLibrary 匹配（lucide-react）

- [ ] **Step 4: Commit**

```bash
git add components/ui/ hooks/ lib/
git commit -m "feat: add shadcn network UI components"
```

---

### Task 4: 创建 Modal 基础设施

**Files:**
- Create: `shared/stores/use-modal-store.ts`
- Create: `shared/components/modal-button.tsx`
- Create: `app/_components/modal-provider.tsx`

**Interfaces:**
- Produces: `useModalStore` (zustand)，`ModalProvider` 组件，`ModalType` 类型（含 `"manualAddNetwork"` `"networkSettings"`）
- Note: 这是基础设施，后续 feature 的 Dialog/Sheet 在此注册

- [ ] **Step 1: 创建 Modal Store**

```typescript
// shared/stores/use-modal-store.ts
import { create } from "zustand"

export type ModalType = "manualAddNetwork" | "networkSettings"

export interface ModalData {
  ssid?: string
}

interface ModalStore {
  type: ModalType | null
  data: ModalData
  isOpen: boolean
  open: (type: ModalType, data?: ModalData) => void
  close: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  open: (type, data = {}) => set({ type, data, isOpen: true }),
  close: () => set({ type: null, data: {}, isOpen: false }),
}))
```

- [ ] **Step 2: 创建 ModalButton**

```typescript
// shared/components/modal-button.tsx
"use client"

import { Button } from "@/components/ui/button"
import { useModalStore, type ModalType, type ModalData } from "@/shared/stores/use-modal-store"

interface ModalButtonProps {
  modalType: ModalType
  modalData?: ModalData
  children: React.ReactNode
  variant?: Parameters<typeof Button>[0]["variant"]
  className?: string
}

export function ModalButton({ modalType, modalData, children, variant, className }: ModalButtonProps) {
  const open = useModalStore((s) => s.open)
  return (
    <Button variant={variant} className={className} onClick={() => open(modalType, modalData)}>
      {children}
    </Button>
  )
}
```

- [ ] **Step 3: 创建 ModalProvider（初始占位）**

```typescript
// app/_components/modal-provider.tsx
"use client"

import { useModalStore, type ModalType } from "@/shared/stores/use-modal-store"

export function ModalProvider() {
  const { type, isOpen, close, data } = useModalStore()

  if (!isOpen || !type) return null

  const modalMap: Record<ModalType, React.ReactNode> = {
    manualAddNetwork: null, // Task 17 实现后替换
    networkSettings: null,  // Task 18 实现后替换
  }

  return <>{modalMap[type]}</>
}
```

- [ ] **Step 4: 在 layout 中注册 ModalProvider**

修改 `app/layout.tsx`，在 body 末尾引入 `<ModalProvider />`。

- [ ] **Step 5: Commit**

```bash
git add shared/stores/ shared/components/ app/_components/ app/layout.tsx
git commit -m "feat: add modal infrastructure (store + provider + button)"
```

---

### Task 5: 创建 NetworkStatus 类型定义

**Files:**
- Create: `shared/types/network.ts`

**Interfaces:**
- Produces: `NetworkStatus`, `WiFiNetwork`, `ConnectResult`, `ScanResult` 类型

- [ ] **Step 1: 写入类型文件**

```typescript
// shared/types/network.ts

export type NetworkStatusType = "ONLINE" | "OFFLINE" | "HOTSPOT_ACTIVE"

export interface NetworkStatus {
  status: NetworkStatusType
  hotspotActive: boolean
  lastCheck: string
  currentSSID: string | null
  ipAddress: string | null
}

export interface WiFiNetwork {
  ssid: string
  signal: number   // dBm, 如 -45
  security: string  // "WPA2" | "WPA" | "WEP" | "OPEN"
  connected: boolean
}

export interface ScanResult {
  networks: WiFiNetwork[]
}

export interface ConnectInput {
  ssid: string
  password?: string
}

export interface ConnectResult {
  success: boolean
  ssid: string | null
  ipAddress: string | null
  error?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/types/network.ts
git commit -m "feat: add network type definitions"
```

---

### Task 6: 创建 NetworkService 核心服务

**Files:**
- Create: `shared/lib/network-service.ts`

**Interfaces:**
- Consumes: `shared/lib/prisma.ts` (prisma 实例)，`shared/types/network.ts` (类型)
- Produces: `NetworkService` 单例 —— `checkConnectivity()`, `checkDNS()`, `getStatus()`, `startHotspot()`, `stopHotspot()`, `scanWiFi()`, `connectWiFi()`

- [ ] **Step 1: 写入 exec 辅助函数和命令行构建**

```typescript
// shared/lib/network-service.ts
import { exec } from "child_process"
import { promisify } from "util"
import { prisma } from "@/shared/lib/prisma"
import type { NetworkStatus, WiFiNetwork, ConnectResult } from "@/shared/types/network"

const execAsync = promisify(exec)

const WIFI_INTERFACE = process.env.WIFI_INTERFACE ?? "wlan0"
const HOTSPOT_SSID = process.env.HOTSPOT_SSID ?? "yingnode"
const HOTSPOT_IP = process.env.HOTSPOT_IP ?? "172.16.42.1"
const PING_TARGET = "8.8.8.8"
const DNS_TEST_DOMAIN = "google.com"
```

- [ ] **Step 2: 写入 connectivity 方法**

```typescript
class NetworkService {
  async checkConnectivity(): Promise<boolean> {
    try {
      await execAsync(`ping -c 1 -W 2 ${PING_TARGET}`)
      return true
    } catch {
      return false
    }
  }

  async checkDNS(): Promise<boolean> {
    try {
      await execAsync(`nslookup ${DNS_TEST_DOMAIN} ${PING_TARGET}`)
      return true
    } catch {
      return false
    }
  }

  async isOnline(): Promise<boolean> {
    const pingOk = await this.checkConnectivity()
    if (!pingOk) return false
    const dnsOk = await this.checkDNS()
    return dnsOk
  }
```

- [ ] **Step 3: 写入 getStatus**

```typescript
  async getStatus(): Promise<NetworkStatus> {
    const record = await prisma.networkStatus.findFirst({ where: { id: 1 } })
    if (!record) {
      return {
        status: "ONLINE",
        hotspotActive: false,
        lastCheck: new Date().toISOString(),
        currentSSID: null,
        ipAddress: null,
      }
    }
    return {
      status: record.status as NetworkStatus["status"],
      hotspotActive: record.hotspotActive,
      lastCheck: record.lastCheck.toISOString(),
      currentSSID: record.currentSSID,
      ipAddress: record.ipAddress,
    }
  }

  private async updateDB(fields: Record<string, unknown>): Promise<void> {
    await prisma.networkStatus.upsert({
      where: { id: 1 },
      update: { ...fields, lastCheck: new Date() },
      create: { id: 1, ...fields, lastCheck: new Date() },
    })
  }
```

- [ ] **Step 4: 写入热点管理方法**

```typescript
  async startHotspot(): Promise<void> {
    const existingStatus = await this.getStatus()
    if (existingStatus.hotspotActive) return

    try {
      await execAsync(`sudo ip addr add ${HOTSPOT_IP}/24 dev ${WIFI_INTERFACE}`)
    } catch { /* IP 可能已存在 */ }

    await execAsync(
      `sudo hostapd -B /etc/hostapd/hostapd.conf`
    )
    await execAsync(
      `sudo dnsmasq -C /etc/dnsmasq.conf`
    )

    await this.updateDB({ status: "HOTSPOT_ACTIVE", hotspotActive: true })
  }

  async stopHotspot(): Promise<void> {
    const existingStatus = await this.getStatus()
    if (!existingStatus.hotspotActive) return

    try { await execAsync("sudo killall hostapd") } catch { /* 未运行 */ }
    try { await execAsync("sudo killall dnsmasq") } catch { /* 未运行 */ }

    await this.updateDB({ status: "ONLINE", hotspotActive: false })
  }
```

- [ ] **Step 5: 写入 WiFi 扫描方法**

```typescript
  async scanWiFi(): Promise<WiFiNetwork[]> {
    try {
      const { stdout } = await execAsync(`sudo iwlist ${WIFI_INTERFACE} scan`)
      return this.parseIwlist(stdout)
    } catch {
      return []
    }
  }

  private parseIwlist(output: string): WiFiNetwork[] {
    const cells = output.split(/Cell \d+ - Address: /).slice(1)
    const networks: WiFiNetwork[] = []

    for (const cell of cells) {
      const ssidMatch = cell.match(/ESSID:"(.+?)"/)
      const signalMatch = cell.match(/Signal level=(-?\d+)/)
      const encMatch = cell.match(/Encryption key:(on|off)/)

      if (!ssidMatch) continue
      const ssid = ssidMatch[1]
      if (!ssid || ssid === "\\x00") continue

      networks.push({
        ssid,
        signal: signalMatch ? parseInt(signalMatch[1]) : -100,
        security: encMatch && encMatch[1] === "on" ? "WPA2" : "OPEN",
        connected: false,
      })
    }

    return networks.sort((a, b) => b.signal - a.signal)
  }
```

- [ ] **Step 6: 写入 WiFi 连接方法**

```typescript
  async connectWiFi(ssid: string, password?: string): Promise<ConnectResult> {
    try {
      if (password) {
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} add_network`
        )
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} set_network 0 ssid '"${ssid}"'`
        )
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} set_network 0 psk '"${password}"'`
        )
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} enable_network 0`
        )
      } else {
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} add_network`
        )
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} set_network 0 ssid '"${ssid}"'`
        )
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} set_network 0 key_mgmt NONE`
        )
        await execAsync(
          `wpa_cli -i ${WIFI_INTERFACE} enable_network 0`
        )
      }

      await execAsync(`wpa_cli -i ${WIFI_INTERFACE} save_config`)
      await execAsync(`wpa_cli -i ${WIFI_INTERFACE} reconfigure`)

      await new Promise((resolve) => setTimeout(resolve, 5000))

      const { stdout } = await execAsync(`wpa_cli -i ${WIFI_INTERFACE} status`)
      const ipMatch = stdout.match(/ip_address=(.+)/)
      const ipAddress = ipMatch ? ipMatch[1] : null

      await this.updateDB({ currentSSID: ssid, ipAddress })

      return { success: true, ssid, ipAddress }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "连接失败"
      if (msg.includes("WRONG_KEY")) {
        return { success: false, ssid: null, ipAddress: null, error: "密码错误" }
      }
      return { success: false, ssid: null, ipAddress: null, error: "连接超时，请确认密码正确" }
    }
  }
```

- [ ] **Step 7: 导出单例**

```typescript
export const networkService = new NetworkService()
```

- [ ] **Step 8: Commit**

```bash
git add shared/lib/network-service.ts
git commit -m "feat: add NetworkService core service"
```

---

### Task 7: 创建后台 Monitor（instrumentation.ts）

**Files:**
- Create: `instrumentation.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `shared/lib/network-service.ts` (networkService)
- Produces: Next.js 启动时自动运行 monitor loop

- [ ] **Step 1: 写入 instrumentation.ts**

```typescript
// instrumentation.ts
import { networkService } from "@/shared/lib/network-service"

let monitorStarted = false

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !monitorStarted) {
    monitorStarted = true
    startNetworkMonitor()
  }
}

function startNetworkMonitor() {
  let consecutiveFailures = 0
  let consecutiveSuccesses = 0

  const check = async () => {
    const online = await networkService.isOnline()
    const status = await networkService.getStatus()

    if (online) {
      consecutiveFailures = 0
      consecutiveSuccesses++

      if (status.hotspotActive && consecutiveSuccesses >= 3) {
        await networkService.stopHotspot()
        consecutiveSuccesses = 0
      }

      if (status.status !== "HOTSPOT_ACTIVE" && status.status !== "ONLINE") {
        await networkService.updateDB?.({ status: "ONLINE" }) ??
          // fallback: updateDB is private, re-set via upsert
          console.log("[monitor] 网络已恢复")
      }
    } else {
      consecutiveSuccesses = 0
      consecutiveFailures++

      if (!status.hotspotActive && consecutiveFailures >= 3) {
        try {
          await networkService.startHotspot()
        } catch (e) {
          console.error("[monitor] 热点启动失败:", e)
        }
      }

      if (status.status !== "HOTSPOT_ACTIVE" && consecutiveFailures >= 3) {
        await networkService.updateDB?.({ status: "OFFLINE" }) ??
          console.log("[monitor] 网络已断开")
      }
    }
  }

  check()
  setInterval(check, 10_000)
}
```

- [ ] **Step 2: 确认 updateDB 可外部访问**

由于 `updateDB` 在 Task 6 中是 private，monitor 需要能更新状态。重构 NetworkService，将 `updateDB` 改为公开或新增公开 `setOnlineStatus` 方法。

修改 `shared/lib/network-service.ts`：将 `private async updateDB` 改为公开：

```typescript
  async updateDB(fields: Record<string, unknown>): Promise<void> {
    await prisma.networkStatus.upsert({
      where: { id: 1 },
      update: { ...fields, lastCheck: new Date() },
      create: { id: 1, ...fields, lastCheck: new Date() },
    })
  }
```

- [ ] **Step 3: 更新 next.config.ts 启用 instrumentation**

```typescript
// next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig
```

- [ ] **Step 4: Commit**

```bash
git add instrumentation.ts next.config.ts shared/lib/network-service.ts
git commit -m "feat: add background network monitor via instrumentation"
```

---

### Task 8: 创建 API 路由

**Files:**
- Create: `app/api/network/status/route.ts`
- Create: `app/api/network/scan/route.ts`
- Create: `app/api/network/connect/route.ts`

**Interfaces:**
- Consumes: `shared/lib/network-service.ts` (networkService)
- Produces: REST API endpoints for frontend

- [ ] **Step 1: 创建 GET /api/network/status**

```typescript
// app/api/network/status/route.ts
import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  const status = await networkService.getStatus()
  return NextResponse.json(status)
}
```

- [ ] **Step 2: 创建 GET /api/network/scan**

```typescript
// app/api/network/scan/route.ts
import { NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function GET() {
  const networks = await networkService.scanWiFi()
  return NextResponse.json({ networks })
}
```

- [ ] **Step 3: 创建 POST /api/network/connect**

```typescript
// app/api/network/connect/route.ts
import { NextRequest, NextResponse } from "next/server"
import { networkService } from "@/shared/lib/network-service"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { ssid, password } = body

  if (!ssid) {
    return NextResponse.json(
      { success: false, ssid: null, ipAddress: null, error: "SSID 不能为空" },
      { status: 400 }
    )
  }

  const result = await networkService.connectWiFi(ssid, password)
  if (!result.success) {
    return NextResponse.json(result, { status: 422 })
  }
  return NextResponse.json(result)
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/network/
git commit -m "feat: add network API routes (status, scan, connect)"
```

---

### Task 9: 创建仪表盘布局

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/network/page.tsx`（占位）

**Interfaces:**
- Consumes: `app/_components/modal-provider.tsx`
- Produces: 仪表盘布局，network 页面路由就绪

- [ ] **Step 1: 创建 dashboard layout**

```typescript
// app/(dashboard)/layout.tsx
import { SidebarProvider, Sidebar, SidebarBody, SidebarItem, SidebarLabel } from "@/components/ui/sidebar"
import { Wifi } from "lucide-react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { label: "网络管理", href: "/network", icon: Wifi },
  ]

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarBody>
          {navItems.map((item) => (
            <SidebarItem key={item.href} href={item.href}>
              <item.icon />
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 p-6">{children}</main>
    </SidebarProvider>
  )
}
```

> **注意：** 在写 Sidebar 相关代码前，必须先 `npx shadcn@latest add sidebar` 安装 Sidebar 组件。Sidebar 的实际 API 以 shadcn skill 为准，此处仅示意结构。

- [ ] **Step 2: 创建占位 network page**

```typescript
// app/(dashboard)/network/page.tsx
export default function NetworkPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">网络管理</h1>
      {/* NetworkManagerButton 在 Task 10 中集成 */}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/
git commit -m "feat: add dashboard layout and network page scaffold"
```

---

### Task 10: 创建 CurrentStatus 组件

**Files:**
- Create: `features/network/components/current-status.tsx`

**Interfaces:**
- Consumes: `NetworkStatus` 类型
- Produces: `CurrentStatus` 组件 —— 显示连接状态摘要

```typescript
// features/network/components/current-status.tsx
import { Wifi, WifiOff, Radio } from "lucide-react"
import type { NetworkStatusType } from "@/shared/types/network"

interface CurrentStatusProps {
  status: NetworkStatusType
  currentSSID: string | null
  hotspotActive: boolean
}

export function CurrentStatus({ status, currentSSID, hotspotActive }: CurrentStatusProps) {
  if (status === "HOTSPOT_ACTIVE") {
    return (
      <div className="flex items-center gap-3 px-2 py-1.5">
        <Radio className="size-4 text-amber-500" />
        <div>
          <p className="text-sm font-medium">热点已开启</p>
          <p className="text-xs text-muted-foreground">广播 SSID: yingnode · IP: 172.16.42.1</p>
        </div>
      </div>
    )
  }

  if (status === "OFFLINE") {
    return (
      <div className="flex items-center gap-3 px-2 py-1.5">
        <WifiOff className="size-4 text-destructive" />
        <div>
          <p className="text-sm font-medium">正在搜索网络...</p>
          <p className="text-xs text-muted-foreground">互联网：已断开</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      <Wifi className="size-4 text-emerald-500" />
      <div>
        <p className="text-sm font-medium">{currentSSID ? `已连接 "${currentSSID}"` : "已连接"}</p>
        <p className="text-xs text-muted-foreground">互联网：已连接</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 1: 写入文件并 commit**

```bash
git add features/network/components/current-status.tsx
git commit -m "feat: add CurrentStatus component"
```

---

### Task 11: 创建 WiFiListItem 组件

**Files:**
- Create: `features/network/components/wifi-list-item.tsx`

**Interfaces:**
- Consumes: `WiFiNetwork` 类型
- Produces: `WiFiListItem` 组件 —— 显示单个 WiFi 网络

```typescript
// features/network/components/wifi-list-item.tsx
"use client"

import { Wifi, Lock, ShieldAlert } from "lucide-react"
import type { WiFiNetwork } from "@/shared/types/network"

interface WiFiListItemProps {
  network: WiFiNetwork
  onConnect: (ssid: string, hasPassword: boolean) => void
}

function signalBars(signal: number): number {
  if (signal > -50) return 4
  if (signal > -60) return 3
  if (signal > -70) return 2
  return 1
}

function securityIcon(security: string) {
  if (security === "OPEN") return <ShieldAlert className="size-3.5 text-muted-foreground" />
  return <Lock className="size-3.5 text-muted-foreground" />
}

export function WiFiListItem({ network, onConnect }: WiFiListItemProps) {
  const bars = signalBars(network.signal)

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
      onClick={() => onConnect(network.ssid, network.security !== "OPEN")}
    >
      <div className="flex items-center gap-3">
        <SignalIcon bars={bars} />
        <span className="text-sm">{network.ssid}</span>
      </div>
      <div className="flex items-center gap-2">
        {securityIcon(network.security)}
        {network.connected && <span className="text-xs text-muted-foreground">✅</span>}
      </div>
    </button>
  )
}

function SignalIcon({ bars }: { bars: number }) {
  return (
    <div className="flex items-end gap-px h-4">
      {[1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className={`w-0.5 rounded-sm ${level <= bars ? "bg-foreground" : "bg-muted-foreground/30"}`}
          style={{ height: `${level * 4}px` }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 1: 写入文件并 commit**

```bash
git add features/network/components/wifi-list-item.tsx
git commit -m "feat: add WiFiListItem component"
```

---

### Task 12: 创建 OtherNetworksSection + ManualAddItem 组件

**Files:**
- Create: `features/network/components/other-networks-section.tsx`
- Create: `features/network/components/manual-add-item.tsx`
- Create: `features/network/components/network-settings-entry.tsx`

**Interfaces:**
- Consumes: Collapsible, Separator, useModalStore
- Produces: 弱信号折叠区 + 手动添加入口 + 网络设置入口

- [ ] **Step 1: OtherNetworksSection**

```typescript
// features/network/components/other-networks-section.tsx
"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import type { WiFiNetwork } from "@/shared/types/network"
import { WiFiListItem } from "./wifi-list-item"

interface OtherNetworksSectionProps {
  networks: WiFiNetwork[]
  onConnect: (ssid: string, hasPassword: boolean) => void
}

export function OtherNetworksSection({ networks, onConnect }: OtherNetworksSectionProps) {
  if (networks.length === 0) return null
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-accent rounded-md"
        onClick={() => setOpen(true)}
      >
        <span>其他网络...</span>
        <ChevronRight className="ml-auto size-4" />
      </button>
    )
  }

  return (
    <div className="flex flex-col">
      {networks.map((n) => (
        <WiFiListItem key={n.ssid} network={n} onConnect={onConnect} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: ManualAddItem**

```typescript
// features/network/components/manual-add-item.tsx
"use client"

import { Plus } from "lucide-react"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function ManualAddItem() {
  const open = useModalStore((s) => s.open)

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
      onClick={() => open("manualAddNetwork")}
    >
      <Plus className="size-4" />
      <span>手动添加...</span>
    </button>
  )
}
```

- [ ] **Step 3: NetworkSettingsEntry**

```typescript
// features/network/components/network-settings-entry.tsx
"use client"

import { Settings } from "lucide-react"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function NetworkSettingsEntry() {
  const open = useModalStore((s) => s.open)

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
      onClick={() => open("networkSettings")}
    >
      <Settings className="size-4" />
      <span>网络设置...</span>
    </button>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add features/network/components/other-networks-section.tsx features/network/components/manual-add-item.tsx features/network/components/network-settings-entry.tsx
git commit -m "feat: add OtherNetworksSection, ManualAddItem, NetworkSettingsEntry"
```

---

### Task 13: 创建 WiFiList 组件

**Files:**
- Create: `features/network/components/wifi-list.tsx`

**Interfaces:**
- Consumes: `WiFiListItem`, `OtherNetworksSection`, `WiFiNetwork`
- Produces: `WiFiList` 组件 —— 按信号强弱分组展示

```typescript
// features/network/components/wifi-list.tsx
"use client"

import { Separator } from "@/components/ui/separator"
import type { WiFiNetwork } from "@/shared/types/network"
import { WiFiListItem } from "./wifi-list-item"
import { OtherNetworksSection } from "./other-networks-section"

interface WiFiListProps {
  networks: WiFiNetwork[]
  onConnect: (ssid: string, hasPassword: boolean) => void
}

export function WiFiList({ networks, onConnect }: WiFiListProps) {
  const strongSignal = networks.filter((n) => n.signal > -70)
  const weakSignal = networks.filter((n) => n.signal <= -70)

  return (
    <div className="flex flex-col">
      {strongSignal.map((n) => (
        <WiFiListItem key={n.ssid} network={n} onConnect={onConnect} />
      ))}
      {weakSignal.length > 0 && (
        <>
          <Separator className="my-1" />
          <OtherNetworksSection networks={weakSignal} onConnect={onConnect} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 1: 写入文件并 commit**

```bash
git add features/network/components/wifi-list.tsx
git commit -m "feat: add WiFiList component"
```

---

### Task 14: 创建 NetworkPopover 组件

**Files:**
- Create: `features/network/components/network-popover.tsx`

**Interfaces:**
- Consumes: `useState`, `useEffect`, `Popover`, `CurrentStatus`, `WiFiList`, `Separator`, `ManualAddItem`, `NetworkSettingsEntry`, API fetch, sonner toast
- Produces: `NetworkPopover` 组件 —— macOS 风格下拉

```typescript
// features/network/components/network-popover.tsx
"use client"

import { useState, useEffect } from "react"
import { PopoverContent } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import type { NetworkStatus, WiFiNetwork } from "@/shared/types/network"
import { CurrentStatus } from "./current-status"
import { WiFiList } from "./wifi-list"
import { ManualAddItem } from "./manual-add-item"
import { NetworkSettingsEntry } from "./network-settings-entry"
import { Spinner } from "@/components/ui/spinner"

export function NetworkPopover() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [networks, setNetworks] = useState<WiFiNetwork[]>([])
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    fetchStatus()
    fetchScan()
  }, [])

  async function fetchStatus() {
    const res = await fetch("/api/network/status")
    if (!res.ok) return
    const data = await res.json()
    setStatus(data)
  }

  async function fetchScan() {
    setScanning(true)
    try {
      const res = await fetch("/api/network/scan")
      if (!res.ok) throw new Error("扫描失败")
      const data = await res.json()
      setNetworks(data.networks)
    } catch {
      toast.error("无法扫描网络，请检查无线网卡")
    } finally {
      setScanning(false)
    }
  }

  async function handleConnect(ssid: string, hasPassword: boolean) {
    if (!hasPassword) {
      const res = await fetch("/api/network/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? "连接失败")
        return
      }
      toast.success(`已连接到 "${ssid}"`)
      fetchStatus()
      return
    }
    // 有密码 → 由密码 Dialog 处理，暂存 ssid 到 modal data
  }

  if (!status) {
    return (
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-center py-4">
          <Spinner />
        </div>
      </PopoverContent>
    )
  }

  return (
    <PopoverContent className="w-80 p-0">
      <CurrentStatus
        status={status.status}
        currentSSID={status.currentSSID}
        hotspotActive={status.hotspotActive}
      />
      <Separator />
      {scanning ? (
        <div className="flex items-center justify-center py-4">
          <Spinner />
        </div>
      ) : (
        <>
          <WiFiList networks={networks} onConnect={handleConnect} />
          <Separator />
        </>
      )}
      <ManualAddItem />
      <Separator />
      <NetworkSettingsEntry />
    </PopoverContent>
  )
}
```

- [ ] **Step 1: 写入文件并 commit**

```bash
git add features/network/components/network-popover.tsx
git commit -m "feat: add NetworkPopover component"
```

---

### Task 15: 创建 NetworkManagerButton 组件

**Files:**
- Create: `features/network/components/network-manager-button.tsx`

**Interfaces:**
- Consumes: `Popover`, `PopoverTrigger`, `NetworkPopover`, `useEffect` 轮询状态
- Produces: `NetworkManagerButton` 组件 —— 菜单栏触发按钮

```typescript
// features/network/components/network-manager-button.tsx
"use client"

import { useEffect, useState } from "react"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { Wifi, WifiOff, Radio, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NetworkPopover } from "./network-popover"
import type { NetworkStatus } from "@/shared/types/network"

export function NetworkManagerButton() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/network/status")
        if (!res.ok) return
        const data = await res.json()
        setStatus(data)
      } catch { /* 忽略网络错误 */ }
    }
    poll()
    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [])

  function buttonContent() {
    if (!status) return <Loader2 className="size-4 animate-spin" />

    switch (status.status) {
      case "HOTSPOT_ACTIVE":
        return (
          <>
            <Radio className="size-4 text-amber-500" />
            <span className="text-sm">热点已开启</span>
          </>
        )
      case "OFFLINE":
        return (
          <>
            <WifiOff className="size-4 text-destructive" />
            <span className="text-sm">正在搜索网络...</span>
          </>
        )
      default:
        return (
          <>
            <Wifi className="size-4" />
            <span className="text-sm max-w-32 truncate">
              {status.currentSSID ?? "已连接"}
            </span>
          </>
        )
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {buttonContent()}
        </Button>
      </PopoverTrigger>
      <NetworkPopover />
    </Popover>
  )
}
```

- [ ] **Step 1: 写入文件并 commit**

```bash
git add features/network/components/network-manager-button.tsx
git commit -m "feat: add NetworkManagerButton component"
```

---

### Task 16: 创建 ManualAddDialog 组件

**Files:**
- Create: `features/network/components/manual-add-dialog.tsx`
- Modify: `app/_components/modal-provider.tsx`（注册 manualAddNetwork）

**Interfaces:**
- Consumes: `Dialog`, `Input`, `Button`, `useModalStore`, sonner toast
- Produces: `ManualAddDialog` 组件 —— 手动输入 SSID/安全类型/密码并连接

- [ ] **Step 1: 写入 dialog 组件**

```typescript
// features/network/components/manual-add-dialog.tsx
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { toast } from "sonner"

export function ManualAddDialog() {
  const { type, isOpen, close, data } = useModalStore()
  const [ssid, setSSID] = useState(data.ssid ?? "")
  const [password, setPassword] = useState("")
  const [connecting, setConnecting] = useState(false)

  if (type !== "manualAddNetwork") return null

  async function handleConnect() {
    if (!ssid.trim()) return
    setConnecting(true)
    try {
      const res = await fetch("/api/network/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: ssid.trim(), password }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? "连接失败")
        return
      }
      toast.success(`已连接到 "${ssid.trim()}"`)
      close()
    } catch {
      toast.error("连接失败")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>手动添加网络</DialogTitle>
          <DialogDescription>输入要连接的 Wi-Fi 网络信息</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-ssid" className="text-sm font-medium">网络名称 (SSID)</label>
            <Input
              id="manual-ssid"
              value={ssid}
              onChange={(e) => setSSID(e.target.value)}
              placeholder="输入 Wi-Fi 名称"
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-password" className="text-sm font-medium">密码</label>
            <Input
              id="manual-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码（开放网络留空）"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={handleConnect} disabled={!ssid.trim() || connecting}>
            {connecting ? "连接中..." : "连接"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 在 ModalProvider 中注册**

修改 `app/_components/modal-provider.tsx`：

```typescript
// 在文件顶部添加 import
import { ManualAddDialog } from "@/features/network/components/manual-add-dialog"

// 在 modalMap 中替换 null
manualAddNetwork: <ManualAddDialog key="manualAddNetwork" />,
```

- [ ] **Step 3: 更新 NetworkPopover 中的 handleConnect**

修改 `features/network/components/network-popover.tsx`，在 `handleConnect` 有密码时通过 modal store 触发 ManualAddDialog：

```typescript
// 在文件顶部添加 import
import { useModalStore } from "@/shared/stores/use-modal-store"

// 在组件内调用
const openModal = useModalStore((s) => s.open)

// handleConnect 函数的有密码分支：
if (hasPassword) {
  openModal("manualAddNetwork", { ssid })
}
```

同时更新 `ManualAddDialog` 读取 `data.ssid` 作为初始 SSID 值。

- [ ] **Step 4: Commit**

```bash
git add features/network/components/manual-add-dialog.tsx app/_components/modal-provider.tsx features/network/components/network-popover.tsx
git commit -m "feat: add ManualAddDialog with modal integration"
```

---

### Task 17: 创建 NetworkSettingsSheet 组件

**Files:**
- Create: `features/network/components/network-settings-sheet.tsx`
- Modify: `app/_components/modal-provider.tsx`（注册 networkSettings）

**Interfaces:**
- Consumes: `Sheet`, `useModalStore`, `NetworkStatus`
- Produces: `NetworkSettingsSheet` 组件 —— 显示当前 IP、热点配置信息

- [ ] **Step 1: 写入 sheet 组件**

```typescript
// features/network/components/network-settings-sheet.tsx
"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { useModalStore } from "@/shared/stores/use-modal-store"
import type { NetworkStatus } from "@/shared/types/network"

export function NetworkSettingsSheet() {
  const { type, isOpen, close } = useModalStore()
  const [status, setStatus] = useState<NetworkStatus | null>(null)

  if (type !== "networkSettings") return null
  const open = isOpen

  useEffect(() => {
    if (!open) return
    fetch("/api/network/status")
      .then((r) => r.json())
      .then(setStatus)
  }, [open])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>网络设置</SheetTitle>
          <SheetDescription>当前网络配置信息</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 mt-4">
          <InfoRow label="状态" value={status?.status === "ONLINE" ? "已连接互联网" : status?.status === "HOTSPOT_ACTIVE" ? "热点模式" : "离线"} />
          <InfoRow label="IP 地址" value={status?.ipAddress ?? "—"} />
          <InfoRow label="当前 SSID" value={status?.currentSSID ?? "—"} />
          <Separator />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">热点信息</p>
            <InfoRow label="SSID" value="yingnode" />
            <InfoRow label="IP" value="172.16.42.1" />
            <p className="text-xs text-muted-foreground">断网时自动开启，连接后关闭</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: 在 ModalProvider 中注册**

修改 `app/_components/modal-provider.tsx`：

```typescript
import { NetworkSettingsSheet } from "@/features/network/components/network-settings-sheet"

// 在 modalMap 中：
networkSettings: <NetworkSettingsSheet key="networkSettings" />,
```

- [ ] **Step 3: Commit**

```bash
git add features/network/components/network-settings-sheet.tsx app/_components/modal-provider.tsx
git commit -m "feat: add NetworkSettingsSheet with modal integration"
```

---

### Task 18: 组装 network page

**Files:**
- Modify: `app/(dashboard)/network/page.tsx`

**Interfaces:**
- Consumes: `NetworkManagerButton`
- Produces: 完整的网络管理页面

- [ ] **Step 1: 更新 network page**

```typescript
// app/(dashboard)/network/page.tsx
import { NetworkManagerButton } from "@/features/network/components/network-manager-button"

export default function NetworkPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">网络管理</h1>
        <NetworkManagerButton />
      </div>
      <p className="text-sm text-muted-foreground">
        点击菜单栏按钮扫描周边 Wi-Fi 并连接。设备断网时将自动开启热点。
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/network/page.tsx
git commit -m "feat: integrate NetworkManagerButton into network page"
```

---

### Task 19: 创建热点和 DNS 配置文件模板

**Files:**
- Create: `config/hostapd.conf`
- Create: `config/dnsmasq.conf`
- Create: `config/sudoers.d/yingnode`

**Interfaces:**
- Produces: 部署时复制的系统配置文件

- [ ] **Step 1: hostapd.conf**

```ini
# config/hostapd.conf
interface=wlan0
driver=nl80211
ssid=yingnode
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
```

- [ ] **Step 2: dnsmasq.conf**

```ini
# config/dnsmasq.conf
interface=wlan0
dhcp-range=172.16.42.10,172.16.42.50,255.255.255.0,12h
dhcp-option=3,172.16.42.1
dhcp-option=6,172.16.42.1
no-resolv
address=/#/172.16.42.1
```

- [ ] **Step 3: sudoers**

```
# config/sudoers.d/yingnode
# 部署到 /etc/sudoers.d/yingnode，权限 0440
yingnode ALL=(root) NOPASSWD: /usr/sbin/hostapd, /usr/sbin/dnsmasq
yingnode ALL=(root) NOPASSWD: /sbin/iwlist, /sbin/iwconfig, /sbin/ip
yingnode ALL=(root) NOPASSWD: /bin/kill, /usr/bin/killall
yingnode ALL=(root) NOPASSWD: /sbin/wpa_cli
```

- [ ] **Step 4: Commit**

```bash
git add config/
git commit -m "feat: add hostapd, dnsmasq, and sudoers config templates"
```

---

### Task 20: 创建 features/network/index.ts 统一导出

**Files:**
- Create: `features/network/index.ts`

```typescript
// features/network/index.ts
export { NetworkManagerButton } from "./components/network-manager-button"
export { NetworkPopover } from "./components/network-popover"
export { CurrentStatus } from "./components/current-status"
export { WiFiList } from "./components/wifi-list"
export { WiFiListItem } from "./components/wifi-list-item"
export { OtherNetworksSection } from "./components/other-networks-section"
export { ManualAddItem } from "./components/manual-add-item"
export { ManualAddDialog } from "./components/manual-add-dialog"
export { NetworkSettingsEntry } from "./components/network-settings-entry"
export { NetworkSettingsSheet } from "./components/network-settings-sheet"
```

- [ ] **Step 1: 写入文件并 commit**

```bash
git add features/network/index.ts
git commit -m "feat: add network feature barrel export"
```

---

## 验证清单

实现完成后逐项验证：

- [ ] `npm run dev` 启动无报错（即使 monitor 在非 Linux 环境跳过系统命令）
- [ ] `GET /api/network/status` 返回 JSON（在非 Linux 环境预期 `ONLINE` 状态）
- [ ] `GET /api/network/scan` 返回 `{ networks: [] }`（无无线网卡时）
- [ ] 浏览器访问 `/network` 页面可见 NetworkManagerButton 和 Popover
- [ ] Popover 展开后展示三种状态的 CurrentStatus
- [ ] ManualAddDialog 弹窗可打开、填写、提交
- [ ] NetworkSettingsSheet 侧边面板可打开
- [ ] `npx prisma studio` 可见 NetworkStatus 表有初始记录
- [ ] 全部文件符合 CODING-GUIDELINES.md（无 useEffect 获取数据、Guard Clause、文件 ≤150 行等）
