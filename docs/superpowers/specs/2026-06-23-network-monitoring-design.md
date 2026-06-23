# 网络监测功能设计文档

> 日期：2026-06-23 | 状态：待审查

## 一、概述

yingnode-web 的核心基础功能。设备持续检测互联网连通性，断网时自动创建 Wi-Fi 热点（固定 IP `172.16.42.1`）供用户连接并配置网络。用户通过 macOS 风格的 Popover 界面扫描和连接 WiFi。

### 目标设备

- Raspberry Pi（Kali Linux），资源有限
- 通过 Docker 部署（`--network host --privileged`）
- 需要 root 权限操作网络接口

---

## 二、架构总览

采用 **方案 A：API 轮询 + 系统命令**，检测逻辑内置 Next.js。

```
Next.js Server
├── instrumentation.ts        # 启动后台 monitor
├── app/api/network/          # API 路由
│   ├── status/route.ts       # GET 当前状态
│   ├── scan/route.ts         # GET 扫描 WiFi
│   └── connect/route.ts      # POST 连接 WiFi
├── shared/lib/
│   └── network-service.ts    # 核心服务：检测、热点、WiFi 操作
├── features/network/
│   └── components/           # UI 组件（macOS 风格）
└── 系统命令 (sudo)
    ├── ping                   # 连通性检测
    ├── hostapd + dnsmasq      # 热点创建/销毁
    ├── iwlist                 # WiFi 扫描
    └── wpa_cli / wpa_supplicant # WiFi 连接
```

---

## 三、网络检测与状态机

### 3.1 检测机制

- **方式**：`ping -c 1 -W 2 8.8.8.8`，每 10 秒执行一次
- **辅助检验**：若 ping IP 成功但 DNS 解析失败，视同离线
- **防抖**：连续 3 次失败→判定离线；连续 3 次成功→判定在线
- **启动**：`instrumentation.ts` 中初始化 monitor 单例

### 3.2 状态机

| 状态 | 含义 | 热点 |
|------|------|------|
| `ONLINE` | 外网可达 | 关闭 |
| `OFFLINE` | 外网不可达，热点尝试中 | 关闭/启动中 |
| `HOTSPOT_ACTIVE` | 断网，热点已启动 | 运行中 |

状态持久化到 SQLite（`NetworkStatus` 表）。

### 3.3 热点操作

- **创建**：`sudo hostapd` + `sudo dnsmasq`
  - SSID：`yingnode`
  - 固定 IP：`172.16.42.1/24`
  - DHCP 池：`172.16.42.10-172.16.42.50`
  - 密码：无（开放网络，设备近距离使用）
- **销毁**：`killall hostapd dnsmasq`，恢复 wlan0 客户端模式

---

## 四、API 设计

| 路由 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/network/status` | GET | 返回网络状态 | — |
| `/api/network/scan` | GET | 扫描周边 WiFi | — |
| `/api/network/connect` | POST | 连接指定 WiFi | `{ ssid, password }` |

### 4.1 GET /api/network/status 响应

```json
{
  "status": "ONLINE",
  "hotspotActive": false,
  "lastCheck": "2026-06-23T12:30:05Z",
  "currentSSID": "MyWiFi",
  "ipAddress": "192.168.1.100"
}
```

### 4.2 GET /api/network/scan 响应

```json
{
  "networks": [
    { "ssid": "MyWiFi", "signal": -45, "security": "WPA2", "connected": true },
    { "ssid": "NeighborNet", "signal": -62, "security": "WPA2", "connected": false },
    { "ssid": "OpenNet", "signal": -78, "security": "OPEN", "connected": false }
  ]
}
```

### 4.3 POST /api/network/connect

**请求**：`{ "ssid": "MyWiFi", "password": "xxxx" }`

**响应**：
```json
{ "success": true, "ssid": "MyWiFi", "ipAddress": "192.168.1.100" }
```

---

## 五、核心服务

### 5.1 NetworkService（`shared/lib/network-service.ts`）

```typescript
class NetworkService {
  // 网络检测
  checkConnectivity(): Promise<boolean>         // ping 8.8.8.8
  checkDNS(): Promise<boolean>                  // 解析 google.com
  
  // 热点管理
  startHotspot(): Promise<void>                 // 执行 hostapd + dnsmasq
  stopHotspot(): Promise<void>                  // kill 进程
  getStatus(): NetworkStatus                    // 从 DB 读状态
  
  // WiFi 操作
  scanWiFi(): Promise<WiFiNetwork[]>            // iwlist scan + 解析
  connectWiFi(ssid: string, password: string): Promise<void>  // wpa_supplicant
}
```

所有系统命令通过 `child_process.exec` + `sudo` 执行。

### 5.2 无线接口

默认使用 `wlan0`，可通过环境变量 `WIFI_INTERFACE` 配置。

### 5.3 命令列表

```bash
# 检测
ping -c 1 -W 2 8.8.8.8
nslookup google.com 8.8.8.8

# 扫描
sudo iwlist $WIFI_INTERFACE scan

# 连接
wpa_cli -i $WIFI_INTERFACE add_network
wpa_cli -i $WIFI_INTERFACE set_network 0 ssid "SSID"
wpa_cli -i $WIFI_INTERFACE set_network 0 psk "password"
wpa_cli -i $WIFI_INTERFACE enable_network 0

# 热点
sudo hostapd /etc/hostapd/hostapd.conf
sudo dnsmasq -C /etc/dnsmasq.conf
sudo killall hostapd dnsmasq
```

### 5.3 sudoers 配置

部署时 `/etc/sudoers.d/yingnode`：
```
yingnode ALL=(root) NOPASSWD: /usr/sbin/hostapd, /usr/sbin/dnsmasq
yingnode ALL=(root) NOPASSWD: /sbin/iwlist, /sbin/iwconfig, /sbin/ip
yingnode ALL=(root) NOPASSWD: /bin/kill, /usr/bin/killall
yingnode ALL=(root) NOPASSWD: /sbin/wpa_cli
```

---

## 六、数据库

### 6.1 Prisma Schema（新增）

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

单行记录，始终更新 id=1 的行。

---

## 七、前端 UI

### 7.1 路由结构

```
app/(dashboard)/
├── layout.tsx
└── network/
    ├── page.tsx
    └── _components/
        ├── network-manager-button.tsx   # 触发按钮
        ├── network-popover.tsx          # Popover 容器
        ├── current-status.tsx           # 顶部状态摘要
        ├── wifi-list.tsx                # 强信号 WiFi 列表
        ├── wifi-list-item.tsx           # 单个 WiFi 项
        ├── other-networks-section.tsx   # "其他网络" 折叠区
        ├── manual-add-item.tsx          # "手动添加..." 入口
        ├── manual-add-dialog.tsx        # Dialog：手动输入 SSID
        ├── network-settings-entry.tsx   # "网络设置..." 按钮
        └── network-settings-sheet.tsx   # Sheet/Dialog：网络设置
```

### 7.2 macOS 风格 Popover 布局

```
┌─────────────────────────────────────┐
│  🟢 已连接 "MyWiFi"                 │  ← current-status
│  互联网：已连接                      │
├─────────────────────────────────────┤
│  📶 MyWiFi           ▂▄▆█  ✅ 🔒  │  ← signal > -70dBm
│  📶 NeighborNet      ▂▄▄       🔒  │    按信号降序排列
│  📶 OpenNet          ▂▂        ⚠️  │
│  ─────────────────────────────      │  ← Separator
│  其他网络...                    ▸   │  ← signal ≤ -70dBm 折叠
│  ─────────────────────────────      │
│  ✚ 手动添加...                      │  ← 弹出 manual-add-dialog
├─────────────────────────────────────┤
│  ⚙️ 网络设置...                     │  ← 弹出 network-settings-sheet
└─────────────────────────────────────┘
```

### 7.3 三种状态下的按钮展示

| 状态 | 按钮外观 | Popover |
|------|---------|---------|
| `ONLINE` | 信号图标 + 当前 SSID | 完整 WiFi 列表 + 已连接标记 |
| `OFFLINE` | 加载图标 + "正在搜索网络..." | 扫描动画 + WiFi 列表 |
| `HOTSPOT_ACTIVE` | 热点图标 + "热点已开启" | 热点信息 + 连接说明 |

### 7.4 使用到的 shadcn 组件

`Popover`, `Command`, `Separator`, `Collapsible`, `Badge`, `Spinner`, `Dialog`, `Sheet`, `sonner`

---

## 八、数据流

### 8.1 WiFi 扫描与连接

```
[点击按钮] → [Popover 打开]
    ├── GET /api/network/status  → 获取状态
    └── GET /api/network/scan    → 扫描 WiFi
            │
        [点击 WiFi 项]
            │
      有密码? ──否──→ POST connect（无密码）
            │
           是
            │
    [弹出密码 Dialog]
            │
    POST /api/network/connect { ssid, password }
            │
      成功? ──否──→ toast 错误信息
            │
           是
            │
    [更新状态 + 关闭 Popover]
```

### 8.2 热点自动切换

```
instrumentation.ts 启动
        │
        ▼
┌──────────────────────────┐
│  每 10s: ping 8.8.8.8    │◄── loop ──┐
│  + DNS 解析 google.com   │            │
└──────────┬───────────────┘            │
           │                            │
    ┌──────▼───────┐                    │
    │ 连续失败 ≥3?  │── 否 ─────────────┘
    └──────┬───────┘
           │ 是
           ▼
    startHotspot()
    ├── hostapd (SSID: yingnode, IP: 172.16.42.1)
    ├── dnsmasq (DHCP: 172.16.42.10-50)
    └── DB: HOTSPOT_ACTIVE
           │
    继续 10s loop
           │
    ┌──────▼───────┐
    │ 连续成功 ≥3?  │── 否 ───────────────────────┘
    └──────┬───────┘
           │ 是
           ▼
    stopHotspot()
    └── DB: ONLINE
    继续 loop
```

---

## 九、错误处理

| 场景 | 处理方式 |
|------|---------|
| WiFi 扫描失败（无无线接口） | toast "无法扫描网络，请检查无线网卡" |
| WiFi 连接超时（30s） | toast "连接超时，请确认密码正确" |
| WiFi 密码错误 | toast "密码错误"（wpa_cli WRONG_KEY） |
| AP 不在范围内 | toast "无法找到该网络" |
| hostapd 启动失败 | toast + DB 回退 OFFLINE + 最多重试 3 次 |
| dnsmasq 端口冲突 | 先 `killall dnsmasq` 再启动 |
| sudo 未配置 | 启动时检测，toast 警告，禁用热点功能 |
| ping 通但 DNS 不通 | 判定为离线 |

---

## 十、部署约束

- Docker 运行需 `--network host --privileged`
- Dockerfile 中需安装 `hostapd`, `dnsmasq`, `wireless-tools`, `wpasupplicant`
- sudoers 配置需在容器启动时注入或构建时写入
- 固定热点 IP `172.16.42.1`，不与常见内网段冲突
