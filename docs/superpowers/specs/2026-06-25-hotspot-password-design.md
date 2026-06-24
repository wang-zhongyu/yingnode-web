# Hotspot Password + Auto-Trigger Design

**Date:** 2026-06-25
**Status:** approved

## Overview

Add WPA2 password protection to the offline hotspot, display the default password during installation, and allow configuring it in settings. Also fix: when the user deletes the currently-connected WiFi record, actively disconnect and trigger hotspot creation instead of waiting passively.

## Motivation

1. 当前热点是**完全开放的**（无密码），任何设备可连接，存在安全风险
2. 安装脚本只展示 SSID，没有密码相关信息
3. 设置页面无法配置热点密码
4. 用户在设置中删除已保存的 WiFi 后，热点不会立即启动（需等待 30 秒监控循环检测离线）

## Design Decisions

- **Hotspot is always WPA2 encrypted** — no open hotspot option
- **Random 12-character password** generated at install time — displayed to user and written to `.env`
- **Active disconnect on forget** — deleting the current WiFi triggers immediate disconnect, so hotspot starts within ~10s (next monitor tick)

## Implementation

### 1. Database (`prisma/schema.prisma`)

Add to `DeviceConfig`:

```prisma
hotspotPassword String @default("")
```

Empty string default maintains backward compatibility with existing databases.

### 2. Network Service (`shared/lib/network-service.ts`)

**`startHotspot()`:**

- Read `DeviceConfig` from DB to get SSID and password
- Generate `/tmp/hostapd.conf` dynamically with WPA2 settings
- Start `hostapd -B /tmp/hostapd.conf`
- Clean up `/tmp/hostapd.conf` in `stopHotspot()`

**`forgetWiFi()`:**

- Before deleting, check if `record.ssid === currentSSID`
- If yes: run `wpa_cli remove_network <id>`, `wpa_cli disconnect`, `wpa_cli reassociate`
- The network monitor loop (10s interval) detects offline → triggers `startHotspot()`

**Dynamic hostapd config:**

```ini
interface=<wifiInterface>
driver=nl80211
ssid=<hotspotSsid>
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=<hotspotPassword>
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
```

### 3. Settings API (`app/api/settings/device/route.ts`)

Extend Zod schema:

```typescript
hotspotPassword: z.string().min(8).optional()
```

The existing GET/PUT route structure handles the new field automatically.

### 4. Device Config Form (`features/settings/components/device-config-form.tsx`)

Add password field below hotspot SSID:

- `type="password"` with show/hide toggle
- Validation: minimum 8 characters
- Placeholder: "请输入热点密码"

### 5. Install Script (`deploy/install.sh`)

In `configure_env()`:

```bash
HOTSPOT_PASSWORD=$(openssl rand -base64 9 | tr -d '=+/' | cut -c1-12)
```

Write to `.env`:

```bash
HOTSPOT_PASSWORD="${HOTSPOT_PASSWORD}"
```

Show at end of installation:

```
========================================
  🎉 安装完成！
  热点 SSID: yingnode
  热点密码: <random-password>
  管理地址: http://172.16.42.1:3000
========================================
```

### 6. Instrumentation (`instrumentation.ts`)

On startup, read `HOTSPOT_PASSWORD` from env and seed into `DeviceConfig` if not already set (alongside existing SSID/interface defaults).

### 7. Remove Static Config

`config/hostapd.conf` can be removed — config is now generated dynamically. The install script's `configure_system()` step that copies it to `/etc/hostapd/` should skip it.

## Affected Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `hotspotPassword` to `DeviceConfig` |
| `shared/lib/network-service.ts` | Dynamic hostapd config generation; active disconnect in `forgetWiFi()` |
| `shared/types/network.ts` | Add `hotspotPassword` to DeviceConfig type |
| `app/api/settings/device/route.ts` | Extend Zod schema with password field |
| `features/settings/components/device-config-form.tsx` | Add password input with show/hide toggle |
| `deploy/install.sh` | Generate random password, display at install completion |
| `instrumentation.ts` | Seed `HOTSPOT_PASSWORD` env var into DB on startup |
| `config/hostapd.conf` | Delete (replaced by dynamic generation) |

## Error Handling

- If `hostapd` fails to start, log the error and keep `NetworkStatus` as `OFFLINE` (don't falsely set `HOTSPOT_ACTIVE`)
- If password is empty/not set, fall back to open hotspot (no encryption) to avoid locking users out
- If `wpa_cli disconnect` fails (interface already down), log and continue — the monitor will still detect offline

## Testing

- Verify hotspot starts with password after WiFi disconnect
- Verify settings page can update password
- Verify install script generates and displays password
- Verify deleting current WiFi triggers hotspot within ~10 seconds
