import { execAsync, escapeShellArg } from "@/shared/lib/shell"

const SERVICE_RESTART = "systemctl restart yingnode 2>/dev/null || true"

export class UpdateManager {
  private savedHead: string | null = null
  private backupDir = ".next.pre-update"

  /** Record current git HEAD and backup the existing .next build output. */
  async snapshot(): Promise<void> {
    // Record HEAD commit SHA for git-based recovery
    try {
      const { stdout } = await execAsync("git rev-parse HEAD", 5000)
      this.savedHead = stdout.trim()
    } catch {
      // Not a git repo or git not available — skip git-based recovery
    }

    // Backup existing build output for fast restore (Strategy A)
    try {
      // Remove stale backup first — if a previous cleanup() was skipped
      // (e.g. process killed during restart), the directory exists and
      // cp -r would nest .next inside it instead of replacing.
      await execAsync(`rm -rf ${escapeShellArg(this.backupDir)}`, 5000)
      await execAsync(`cp -r .next ${escapeShellArg(this.backupDir)}`, 15000)
    } catch {
      // .next may not exist (fresh deploy) — non-fatal
    }
  }

  /** Restore the pre-update state after a failed update.
   *  Strategy A: restore .next.pre-update backup (fast).
   *  Strategy B: git checkout + full rebuild (slow, used when backup unavailable).
   *  Set restart: false to skip service restart (caller handles it after sending response). */
  async rollback(opts?: { restart?: boolean }): Promise<void> {
    const shouldRestart = opts?.restart ?? true
    const fs = await import("fs/promises")

    // Strategy A: restore previous build backup
    try {
      await fs.access(this.backupDir)
      console.log("[update] Restoring previous build from backup...")
      // Atomic: remove current .next and move backup into place in one shell command
      await execAsync(`rm -rf .next && mv ${escapeShellArg(this.backupDir)} .next`, 5000)
      if (shouldRestart) {
        try { await execAsync(SERVICE_RESTART, 5000) } catch { /* restart kills process */ }
      }
      return
    } catch {
      // backup doesn't exist, fall through to Strategy B
    }

    // Strategy B: full git reset + rebuild
    if (!this.savedHead) {
      console.error("[update] No saved HEAD and no backup — cannot rollback")
      if (shouldRestart) {
        try { await execAsync(SERVICE_RESTART, 5000) } catch { }
      }
      return
    }

    console.log(`[update] Resetting to ${this.savedHead} and rebuilding...`)
    try {
      await execAsync(`git checkout ${escapeShellArg(this.savedHead)}`, 10000)
      await execAsync("npm ci --omit=dev", 300000)
      await execAsync("npx prisma generate --no-engine", 60000)
      await execAsync("npm run build", 300000)
      if (shouldRestart) {
        await execAsync(SERVICE_RESTART, 5000)
      }
    } catch (err) {
      console.error("[update] Strategy B rollback failed:", err)
      if (shouldRestart) {
        try { await execAsync(SERVICE_RESTART, 5000) } catch { }
      }
    }
  }

  /** Remove the backup after a successful update. */
  async cleanup(): Promise<void> {
    try {
      await execAsync(`rm -rf ${escapeShellArg(this.backupDir)}`, 5000)
    } catch {
      // best-effort
    }
  }
}
