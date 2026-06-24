# Hotspot Password + Interface Self-Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WPA2 password protection to the offline hotspot, show password at install time, add password field to settings, and add WiFi interface self-check/auto-correction.

**Architecture:** Extend `DeviceConfig` model with `hotspotPassword` field, plumb it through config lib → API → form. Rewrite `startHotspot()` to generate hostapd config dynamically. Add `ensureInterfaceReady()` to auto-correct interface state. Add active disconnect to `forgetWiFi()`.

**Tech Stack:** Prisma + SQLite, Next.js App Router, react-hook-form + zod, bash (install script), hostapd/dnsmasq/wpa_cli (system tools)

## Global Constraints

- Hotspot is always WPA2 encrypted — no open hotspot option
- Empty password falls back to open hotspot (backward compat, error resilience)
- Random 12-char password generated at install time
- All sudo commands must be whitelisted in `/etc/sudoers.d/yingnode`
- `useState` ≤ 2 per component; no `useEffect` for data fetching

---

## File Structure Overview

| File | Role |
|------|------|
| `prisma/schema.prisma` | DB schema: add `hotspotPassword` to `DeviceConfig` |
| `features/settings/lib/device-config.ts` | Config reader: add `hotspotPassword` with env fallback |
| `shared/types/network.ts` | TypeScript types: add `DeviceConfig` interface (currently inferred from Prisma) |
| `features/settings/schemas/device-config.schema.ts` | Zod validation: add `hotspotPassword` field |
| `app/api/settings/device/route.ts` | API: route already passes-through Zod schema, no change needed |
| `features/settings/components/device-config-form.tsx` | UI: add password input with show/hide toggle |
| `shared/lib/network-service.ts` | Core: dynamic hostapd config, `ensureInterfaceReady()`, active disconnect |
| `instrumentation.ts` | Startup: seed password; monitor loop: call `ensureInterfaceReady()` |
| `deploy/install.sh` | Install: generate password, display at completion |
| `config/sudoers.d/yingnode` | Sudo: add `nmcli` whitelist |
| `config/hostapd.conf` | Delete: replaced by dynamic generation |

---

### Task 1: Database Schema — Add `hotspotPassword` to `DeviceConfig`

**Files:**
- Modify: `prisma/schema.prisma:36-41`

**Interfaces:**
- Produces: `DeviceConfig.hotspotPassword` column (String, default `""`)

- [ ] **Step 1: Add field to Prisma schema**

Edit `prisma/schema.prisma`, add `hotspotPassword` to the `DeviceConfig` model:

```prisma
model DeviceConfig {
  id              Int    @id @default(1)
  wifiInterface   String @default("wlan0")
  hotspotIp       String @default("172.16.42.1")
  hotspotSsid     String @default("yingnode")
  hotspotPassword String @default("")
}
```

- [ ] **Step 2: Push schema to database**

```bash
npx prisma db push
```

Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Regenerate Prisma Client**

```bash
npx prisma generate
```

Expected: Client generated successfully at `lib/generated/prisma`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add hotspotPassword to DeviceConfig"
```

---

### Task 2: Config Lib — Add hotspotPassword with Env Fallback

**Files:**
- Modify: `features/settings/lib/device-config.ts:1-22`

**Interfaces:**
- Consumes: `DeviceConfig.hotspotPassword` from DB (Task 1)
- Produces: `getDeviceConfig()` returns object with `hotspotPassword: string`

- [ ] **Step 1: Add hotspotPassword to FALLBACK and return value**

Replace the file content:

```typescript
import { prisma } from "@/shared/lib/prisma"

const FALLBACK = {
  wifiInterface: process.env.WIFI_INTERFACE ?? "wlan0",
  hotspotIp: process.env.HOTSPOT_IP ?? "172.16.42.1",
  hotspotSsid: process.env.HOTSPOT_SSID ?? "yingnode",
  hotspotPassword: process.env.HOTSPOT_PASSWORD ?? "",
}

export async function getDeviceConfig() {
  try {
    const config = await prisma.deviceConfig.findFirst({ where: { id: 1 } })
    return {
      wifiInterface: config?.wifiInterface ?? FALLBACK.wifiInterface,
      hotspotIp: config?.hotspotIp ?? FALLBACK.hotspotIp,
      hotspotSsid: config?.hotspotSsid ?? FALLBACK.hotspotSsid,
      hotspotPassword: config?.hotspotPassword ?? FALLBACK.hotspotPassword,
    }
  } catch {
    // prisma not initialized (edge runtime) or table missing — return env fallback
    return { ...FALLBACK }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/settings/lib/device-config.ts
git commit -m "feat(config): add hotspotPassword with env fallback to getDeviceConfig"
```

---

### Task 3: Zod Schema — Add hotspotPassword Validation

**Files:**
- Modify: `features/settings/schemas/device-config.schema.ts:1-15`

**Interfaces:**
- Produces: `DeviceConfigInput` type now includes `hotspotPassword?: string`

- [ ] **Step 1: Add hotspotPassword field to Zod schema**

Replace the file content:

```typescript
import { z } from "zod"

export const deviceConfigSchema = z.object({
  wifiInterface: z.string().min(1).optional(),
  hotspotIp: z
    .string()
    .regex(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
      "Must be a valid IPv4 address",
    )
    .optional(),
  hotspotSsid: z.string().min(1).max(32).optional(),
  hotspotPassword: z
    .string()
    .min(8, "密码至少 8 位")
    .max(63, "密码最多 63 位")
    .optional()
    .or(z.literal("")),
})

export type DeviceConfigInput = z.infer<typeof deviceConfigSchema>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/settings/schemas/device-config.schema.ts
git commit -m "feat(schema): add hotspotPassword validation to deviceConfigSchema"
```

---

### Task 4: DeviceConfigForm — Add Password Input with Show/Hide Toggle

**Files:**
- Modify: `features/settings/components/device-config-form.tsx:1-95`
- Check: `app/(settings)/settings/general/page.tsx:1-15` (no change needed — passes config through)

**Interfaces:**
- Consumes: `config.hotspotPassword` from props (string)
- Produces: password field in form UI, submitted to `PUT /api/settings/device`

- [ ] **Step 1: Update Props interface and add password field**

Replace the file content:

```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import {
  deviceConfigSchema,
  type DeviceConfigInput,
} from "@/features/settings/schemas/device-config.schema"
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

interface Props {
  config: {
    wifiInterface: string
    hotspotIp: string
    hotspotSsid: string
    hotspotPassword: string
  }
}

export function DeviceConfigForm({ config }: Props) {
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeviceConfigInput>({
    resolver: zodResolver(deviceConfigSchema),
    defaultValues: config,
  })

  const onSubmit = async (data: DeviceConfigInput) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/device", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? "保存失败")
      }

      toast.success("设置已保存，下次网络操作时生效")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "保存失败"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="device-config-form" onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>设备配置</CardTitle>
          <CardDescription>配置 WiFi 网卡、热点 IP、SSID 和密码等基本参数</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>WiFi 网卡接口</FieldLabel>
              <Input placeholder="wlan0" {...register("wifiInterface")} />
              <FieldError errors={errors.wifiInterface ? [errors.wifiInterface] : undefined} />
            </Field>
            <Field>
              <FieldLabel>热点 IP 地址</FieldLabel>
              <Input placeholder="172.16.42.1" {...register("hotspotIp")} />
              <FieldError errors={errors.hotspotIp ? [errors.hotspotIp] : undefined} />
            </Field>
            <Field>
              <FieldLabel>热点 SSID</FieldLabel>
              <Input placeholder="yingnode" {...register("hotspotSsid")} />
              <FieldError errors={errors.hotspotSsid ? [errors.hotspotSsid] : undefined} />
            </Field>
            <Field>
              <FieldLabel>热点密码</FieldLabel>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入热点密码（至少 8 位）"
                  {...register("hotspotPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <FieldError errors={errors.hotspotPassword ? [errors.hotspotPassword] : undefined} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            保存设置
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/settings/components/device-config-form.tsx
git commit -m "feat(ui): add hotspot password field with show/hide toggle to DeviceConfigForm"
```

---

### Task 5: Network Service — Dynamic hostapd Config, ensureInterfaceReady, Active Disconnect

**Files:**
- Modify: `shared/lib/network-service.ts:1-392`

**Interfaces:**
- Consumes: `getDeviceConfig()` now returns `hotspotPassword` (Task 2)
- Produces: `ensureInterfaceReady()` method; `startHotspot()` generates dynamic config; `forgetWiFi()` triggers active disconnect

- [ ] **Step 1: Update imports and config cache type (lines 1-4, 12)**

Change line 1-4 imports — add `execAsync` is already imported. No import changes needed except ensure `escapeShellArg` is available (already imported).

Update line 12 — widen config cache to accept the new return type from `getDeviceConfig()`:

```typescript
private configCache: Awaited<ReturnType<typeof getDeviceConfig>> | null = null
```

Replace lines 1 and 12 — the import line stays the same, just update the cache type:

```typescript
// Line 1-4: unchanged
import { prisma } from "@/shared/lib/prisma"
import { getDeviceConfig } from "@/features/settings/lib/device-config"
import { execAsync, escapeShellArg } from "@/shared/lib/shell"
import type { NetworkStatus, WiFiNetwork, ConnectResult } from "@/shared/types/network"
```

```typescript
// Line 12: replace cache type
private configCache: Awaited<ReturnType<typeof getDeviceConfig>> | null = null
```

- [ ] **Step 2: Add `ensureInterfaceReady()` method**

Insert after the `clearConfigCache()` method (after line 26). Add this new method:

```typescript
/** Check and correct WiFi interface state before network operations.
 *  1. Bring interface UP if down
 *  2. Switch from Monitor to Managed mode (hostapd + nl80211 can go AP from managed, not monitor)
 *  3. Tell NetworkManager to unmanage the interface if NM is running
 *  Returns false only if the interface is missing entirely. */
async ensureInterfaceReady(): Promise<{ ok: boolean; reason?: string }> {
  const { wifiInterface } = await this.getConfig()

  // 1. Check interface exists and is UP
  try {
    const { stdout: upOutput } = await execAsync(`ip link show ${wifiInterface}`)
    if (!upOutput.includes(wifiInterface)) {
      return { ok: false, reason: `Interface ${wifiInterface} not found` }
    }
    if (upOutput.includes("state DOWN")) {
      await execAsync(`sudo ip link set ${wifiInterface} up`)
      console.log(`[network] Brought ${wifiInterface} UP`)
    }
  } catch {
    return { ok: false, reason: `Cannot read state of ${wifiInterface}` }
  }

  // 2. Check wireless mode — must not be Monitor
  try {
    const { stdout: modeOutput } = await execAsync(`iwconfig ${wifiInterface} 2>/dev/null`)
    if (modeOutput.includes("Mode:Monitor")) {
      await execAsync(`sudo iwconfig ${wifiInterface} mode managed`)
      console.log(`[network] Switched ${wifiInterface} from Monitor to Managed`)
    }
  } catch {
    // iwconfig may fail on non-wireless interfaces — non-fatal
  }

  // 3. Check for NetworkManager interference
  try {
    await execAsync("systemctl is-active --quiet NetworkManager")
    await execAsync(
      `sudo nmcli device set ${wifiInterface} managed no 2>/dev/null || true`,
    )
    console.log(`[network] Told NetworkManager to unmanage ${wifiInterface}`)
  } catch {
    // NetworkManager not running — ok
  }

  return { ok: true }
}
```

- [ ] **Step 3: Rewrite `startHotspot()` to generate dynamic hostapd config**

Replace the `startHotspot()` method (lines 105-116):

```typescript
async startHotspot(): Promise<void> {
  const existingStatus = await this.getStatus()
  if (existingStatus.hotspotActive) return

  // Ensure interface is ready before starting hostapd
  const ready = await this.ensureInterfaceReady()
  if (!ready.ok) {
    console.error(`[network] Cannot start hotspot: ${ready.reason}`)
    return
  }

  this.staticIpEnsured = false
  await this.ensureStaticIp()

  const { wifiInterface, hotspotSsid, hotspotPassword } = await this.getConfig()

  // Generate dynamic hostapd config
  let configLines = [
    `interface=${wifiInterface}`,
    "driver=nl80211",
    `ssid=${hotspotSsid}`,
    "hw_mode=g",
    "channel=6",
    "wmm_enabled=0",
    "macaddr_acl=0",
    "auth_algs=1",
    "ignore_broadcast_ssid=0",
  ]

  if (hotspotPassword) {
    configLines.push(
      "wpa=2",
      `wpa_passphrase=${hotspotPassword}`,
      "wpa_key_mgmt=WPA-PSK",
      "wpa_pairwise=TKIP",
      "rsn_pairwise=CCMP",
    )
  }

  const configPath = "/tmp/hostapd-yingnode.conf"
  const fs = await import("fs/promises")
  await fs.writeFile(configPath, configLines.join("\n") + "\n")

  try {
    await execAsync(`sudo hostapd -B ${configPath}`)
    await execAsync("sudo dnsmasq -C /etc/dnsmasq.conf")
    await this.updateDB({ status: "HOTSPOT_ACTIVE", hotspotActive: true })
  } catch (err) {
    console.error("[network] Failed to start hotspot:", err)
    // Don't set HOTSPOT_ACTIVE if hostapd failed
    try { await fs.unlink(configPath) } catch { /* best-effort cleanup */ }
  }
}
```

- [ ] **Step 4: Update `stopHotspot()` to clean up temp config**

Replace the `stopHotspot()` method (lines 118-130):

```typescript
async stopHotspot(): Promise<void> {
  const existingStatus = await this.getStatus()
  if (!existingStatus.hotspotActive) return

  try { await execAsync("sudo killall hostapd") } catch { /* not running */ }
  try { await execAsync("sudo killall dnsmasq") } catch { /* not running */ }

  // Clean up temp config
  try {
    const fs = await import("fs/promises")
    await fs.unlink("/tmp/hostapd-yingnode.conf")
  } catch { /* already cleaned */ }

  // Keep static IP on interface so the device remains reachable
  this.staticIpEnsured = false
  await this.ensureStaticIp()

  await this.updateDB({ status: "ONLINE", hotspotActive: false })
}
```

- [ ] **Step 5: Add active disconnect to `forgetWiFi()`**

Replace the `forgetWiFi()` method (lines 262-288). Insert after deleting from wpa_supplicant but before DB delete, add current-SSID check and active disconnect:

```typescript
async forgetWiFi(id: number): Promise<boolean> {
  const record = await prisma.wiFiRecord.findUnique({ where: { id } })
  if (!record) {
    throw new Error("WiFi record not found")
  }

  const { wifiInterface } = await this.getConfig()
  const escapedIface = escapeShellArg(wifiInterface)

  // Check if this is the currently-connected SSID
  const status = await this.getStatus()
  const isCurrentConnection = status.currentSSID === record.ssid

  try {
    const networkId = await this.getWpaNetworkId(record.ssid, wifiInterface)
    if (networkId !== null) {
      await execAsync(
        `wpa_cli -i ${escapedIface} remove_network ${networkId}`,
      )
      // If this was the active connection, disconnect so the monitor
      // detects offline and starts the hotspot within ~10s
      if (isCurrentConnection) {
        try {
          await execAsync(`wpa_cli -i ${escapedIface} disconnect`)
        } catch { /* interface may already be down */ }
      }
      await execAsync(`wpa_cli -i ${escapedIface} save_config`)
    }
  } catch (err) {
    console.warn(
      `[network] Failed to remove wpa_cli network for "${record.ssid}":`,
      err,
    )
  }

  await prisma.wiFiRecord.delete({ where: { id } })
  return true
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add shared/lib/network-service.ts
git commit -m "feat(network): dynamic hostapd config, ensureInterfaceReady, active disconnect on forget"
```

---

### Task 6: Instrumentation — Seed Password + Interface Check in Monitor Loop

**Files:**
- Modify: `instrumentation.ts:1-72`

**Interfaces:**
- Consumes: `networkService.ensureInterfaceReady()` (Task 5)
- Produces: password seeded on startup; interface checked each monitor tick

- [ ] **Step 1: Add password seeding and interface check to monitor loop**

Replace the file content:

```typescript
let monitorStarted = false

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !monitorStarted) {
    monitorStarted = true

    // Dynamic import — network-service uses Node.js modules
    // (child_process, path, prisma) which are NOT Edge Runtime compatible.
    const { networkService } = await import("@/shared/lib/network-service")

    // Seed hotspot password from env into DB if not set
    if (process.env.HOTSPOT_PASSWORD) {
      try {
        const { prisma } = await import("@/shared/lib/prisma")
        const existing = await prisma.deviceConfig.findFirst({ where: { id: 1 } })
        if (!existing?.hotspotPassword) {
          await prisma.deviceConfig.upsert({
            where: { id: 1 },
            update: { hotspotPassword: process.env.HOTSPOT_PASSWORD },
            create: {
              id: 1,
              hotspotPassword: process.env.HOTSPOT_PASSWORD,
            },
          })
        }
      } catch (err) {
        console.warn("[init] Failed to seed hotspot password:", err)
      }
    }

    // Ensure the device is always reachable on the fixed IP
    await networkService.ensureStaticIp()

    startNetworkMonitor(networkService)

    // Add: start metrics collector
    const { startMetricsCollector } = await import(
      "@/features/monitoring/lib/metrics-collector"
    )
    startMetricsCollector()
  }
}

function startNetworkMonitor(networkService: {
  isOnline(): Promise<boolean>
  getStatus(): Promise<{
    status: string
    hotspotActive: boolean
    lastCheck: string
    currentSSID: string | null
    ipAddress: string | null
  }>
  startHotspot(): Promise<void>
  stopHotspot(): Promise<void>
  updateDB(fields: Record<string, unknown>): Promise<void>
  ensureInterfaceReady(): Promise<{ ok: boolean; reason?: string }>
}) {
  let consecutiveFailures = 0
  let consecutiveSuccesses = 0

  const check = async () => {
    try {
      // Verify interface is in correct state before connectivity checks
      const ready = await networkService.ensureInterfaceReady()
      if (!ready.ok) {
        console.warn(`[monitor] Interface not ready: ${ready.reason}; skipping tick`)
        return
      }

      const online = await networkService.isOnline()
      const status = await networkService.getStatus()

      if (online) {
        consecutiveFailures = 0
        consecutiveSuccesses++

        if (status.hotspotActive && consecutiveSuccesses >= 3) {
          await networkService.stopHotspot()
          consecutiveSuccesses = 0
        }
      } else {
        consecutiveSuccesses = 0
        consecutiveFailures++

        if (!status.hotspotActive && consecutiveFailures >= 3) {
          await networkService.startHotspot()
        }

        if (status.status !== "HOTSPOT_ACTIVE" && consecutiveFailures >= 3) {
          await networkService.updateDB({ status: "OFFLINE" })
        }
      }
    } catch (error) {
      console.error("[monitor] check error:", error)
    }
  }

  check()
  setInterval(check, 10_000)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add instrumentation.ts
git commit -m "feat(monitor): seed hotspot password on startup, interface check each tick"
```

---

### Task 7: Install Script — Generate Password and Display

**Files:**
- Modify: `deploy/install.sh:181-202` (configure_env), `deploy/install.sh:271-283` (show_info)

**Interfaces:**
- Produces: `HOTSPOT_PASSWORD` in `.env`; displayed at install completion

- [ ] **Step 1: Generate random password in configure_env()**

Replace the `configure_env()` function (lines 181-203):

```bash
# ---- 配置环境变量 ----
configure_env() {
    if [ -f "$INSTALL_DIR/.env" ]; then
        log ".env 已存在，跳过"
        # 加载已有配置供后续步骤使用
        set -a; . "$INSTALL_DIR/.env"; set +a
        return
    fi

    # 先生成密钥，确保 shell 变量可用（供 install_service 的 sed 使用）
    BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
    TERMINAL_TOKEN="$(openssl rand -base64 16)"
    HOTSPOT_PASSWORD="$(openssl rand -base64 9 | tr -d '=+/' | cut -c1-12)"

    log "创建 .env 配置..."
    cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="file:/data/yingnode.db"
WIFI_INTERFACE="wlan0"
HOTSPOT_SSID="yingnode"
HOTSPOT_IP="172.16.42.1"
HOTSPOT_PASSWORD="${HOTSPOT_PASSWORD}"
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET}"
TERMINAL_TOKEN="${TERMINAL_TOKEN}"
EOF
    log ".env 已创建"
}
```

- [ ] **Step 2: Update show_info() to display password**

Replace the `show_info()` function (lines 271-283):

```bash
# ---- 显示部署信息 ----
show_info() {
    LOCAL_IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo "172.16.42.1")
    # Load HOTSPOT_PASSWORD from .env if not already in env
    if [ -z "${HOTSPOT_PASSWORD:-}" ] && [ -f "$INSTALL_DIR/.env" ]; then
        set -a; . "$INSTALL_DIR/.env"; set +a
    fi
    echo ""
    log "============================================"
    log "  YingNode 部署完成!"
    log "============================================"
    log "  Web 面板:     http://${LOCAL_IP}:3000"
    log "  热点 SSID:    yingnode"
    log "  热点密码:     ${HOTSPOT_PASSWORD:-未设置}"
    log "  热点 IP:      172.16.42.1"
    log "  ----------------------------------------"
    log "  服务状态:     systemctl status yingnode"
    log "  查看日志:     journalctl -u yingnode -f"
    log "============================================"
}
```

- [ ] **Step 3: Remove hostapd config copy from configure_system()**

Replace the `configure_system()` function (lines 170-178) to remove the hostapd config copy line:

```bash
# ---- 配置系统 ----
configure_system() {
    log "写入系统配置..."
    cp "$INSTALL_DIR/config/sudoers.d/yingnode" /etc/sudoers.d/yingnode
    chmod 440 /etc/sudoers.d/yingnode

    # dnsmasq config is still static
    cp -n "$INSTALL_DIR/config/dnsmasq.conf" /etc/dnsmasq.conf 2>/dev/null || true
}
```

- [ ] **Step 4: Commit**

```bash
git add deploy/install.sh
git commit -m "feat(install): generate random hotspot password and display at completion"
```

---

### Task 8: Sudoers — Add nmcli Whitelist

**Files:**
- Modify: `config/sudoers.d/yingnode:1-4`

**Interfaces:**
- Produces: `nmcli` available via sudo for NetworkManager interference handling

- [ ] **Step 1: Add nmcli to sudoers**

Replace the file content:

```
yingnode ALL=(root) NOPASSWD: /usr/sbin/hostapd, /usr/sbin/dnsmasq
yingnode ALL=(root) NOPASSWD: /sbin/iwlist, /sbin/iwconfig, /sbin/ip
yingnode ALL=(root) NOPASSWD: /bin/kill, /usr/bin/killall
yingnode ALL=(root) NOPASSWD: /sbin/wpa_cli
yingnode ALL=(root) NOPASSWD: /usr/bin/nmcli
```

- [ ] **Step 2: Commit**

```bash
git add config/sudoers.d/yingnode
git commit -m "feat(sudo): add nmcli to sudo whitelist for NetworkManager handling"
```

---

### Task 9: Delete Static hostapd Config

**Files:**
- Delete: `config/hostapd.conf`

**Interfaces:**
- No remaining consumers — `startHotspot()` now generates config dynamically (Task 5)

- [ ] **Step 1: Delete the file**

```bash
git rm config/hostapd.conf
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove static hostapd.conf, replaced by dynamic generation"
```

---

### Task 10: TypeScript Types — Add DeviceConfig Interface

**Files:**
- Modify: `shared/types/network.ts:1-47`

**Interfaces:**
- Produces: `DeviceConfig` interface for explicit typing

- [ ] **Step 1: Add DeviceConfig interface**

Add to the end of `shared/types/network.ts`:

```typescript
export interface DeviceConfig {
  wifiInterface: string
  hotspotIp: string
  hotspotSsid: string
  hotspotPassword: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/types/network.ts
git commit -m "feat(types): add DeviceConfig interface"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Review all files changed**

```bash
git diff --stat main
```

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final verification after hotspot password feature"
```
