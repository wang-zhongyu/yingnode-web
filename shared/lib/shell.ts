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
