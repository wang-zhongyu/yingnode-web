import { execAsync } from "@/shared/lib/shell"

// Patterns that indicate a command may affect network reachability
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /iptables\s+(-[PFX]|--policy|--flush)/, label: "修改 iptables 规则/默认策略" },
  { pattern: /ip\s+link\s+set\s+\S+\s+down/, label: "禁用网络接口" },
  { pattern: /ip\s+route\s+(del|flush|replace)/, label: "删除/修改路由表" },
  { pattern: /nmcli\s+dev(ice)?\s+disconnect/, label: "断开网络连接" },
  { pattern: /nmcli\s+dev(ice)?\s+set\s+\S+\s+managed\s+(yes|no)/, label: "修改 NM 接口管理状态" },
  { pattern: /systemctl\s+stop\s+(NetworkManager|systemd-networkd|wpa_supplicant|yingnode)/, label: "停止关键网络/应用服务" },
  { pattern: /systemctl\s+disable\s+(NetworkManager|systemd-networkd|yingnode)/, label: "禁用关键网络/应用服务" },
  { pattern: /modprobe\s+-r\s+\w+/, label: "卸载内核模块" },
  { pattern: />\s*\/etc\/(network|hosts|resolv|hostname)/, label: "覆盖系统网络配置文件" },
  { pattern: /ufw\s+(enable|disable|default\s+(deny|reject))/, label: "修改防火墙默认策略" },
  { pattern: /dhclient\s+-r/, label: "释放 DHCP 租约" },
  { pattern: /ifconfig\s+\S+\s+down/, label: "禁用网络接口 (ifconfig)" },
  { pattern: /route\s+(del|add\s+default)/, label: "修改路由表 (route 命令)" },
]

export interface SafetyCheckResult {
  safe: boolean
  warnings: string[]
}

/** Backup current network configuration state before running an install script.
 *  Returns the backup directory path so it can be restored if needed. */
export async function backupNetworkConfig(): Promise<string | null> {
  const timestamp = Date.now()
  const backupDir = `/tmp/yingnode-net-backup-${timestamp}`
  try {
    await execAsync(`mkdir -p ${backupDir}`, 3000)
    // iptables rules
    try { await execAsync(`sudo iptables-save > ${backupDir}/iptables.v4`, 3000) } catch { /* may not exist */ }
    try { await execAsync(`sudo ip6tables-save > ${backupDir}/iptables.v6`, 3000) } catch { }
    // Routing table
    try { await execAsync(`ip route show > ${backupDir}/routes`, 3000) } catch { }
    // Interface addresses
    try { await execAsync(`ip addr show > ${backupDir}/interfaces`, 3000) } catch { }
    // DNS config
    try { await execAsync(`cp /etc/resolv.conf ${backupDir}/resolv.conf 2>/dev/null || true`, 3000) } catch { }
    return backupDir
  } catch {
    return null
  }
}

/** Scan a command string for known dangerous patterns.
 *  Returns a list of human-readable warnings about matched patterns. */
export function detectDangerousCommands(command: string): string[] {
  const warnings: string[] = []
  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      warnings.push(`检测到危险操作: ${label}`)
    }
  }
  return warnings
}

/** Check if a command is safe to run automatically. */
export function checkCommandSafety(command: string): SafetyCheckResult {
  const warnings = detectDangerousCommands(command)
  return {
    safe: warnings.length === 0,
    warnings,
  }
}
