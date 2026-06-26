import { exec } from "child_process"
import { promisify } from "util"

const execAsyncBase = promisify(exec)

/** exec with default timeout to prevent hanging on missing commands */
export function execAsync(command: string, timeoutMs = 8000) {
  return execAsyncBase(command, { timeout: timeoutMs })
}

/** Escape a value for safe interpolation inside single-quoted shell strings.
 *  Replaces each ' with '\'' (end quote, escaped quote, resume quote). */
export function escapeShellArg(arg: string): string {
  return arg.replace(/'/g, "'\\''")
}

/** Escape and single-quote a shell argument. Use this for any value
 *  that is interpolated directly into a shell command string at a position
 *  where it should be treated as a single word argument.
 *
 *  Prefer safeArg() over escapeShellArg() for direct interpolation.
 *  Use escapeShellArg() only when the caller handles its own quoting,
 *  e.g. nested quoting like ssid '"${escapedSSID}"'. */
export function safeArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`
}
