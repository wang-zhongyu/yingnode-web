import { execAsync, safeArg } from "@/shared/lib/shell"

/** Check if the ssh systemd service is currently running. */
export async function isSshActive(): Promise<boolean> {
  try {
    await execAsync("systemctl is-active --quiet ssh")
    return true
  } catch {
    return false
  }
}

/** Enable and start the ssh service. */
export async function enableSsh(): Promise<void> {
  await execAsync("systemctl enable --now ssh")
}

/** Disable and stop the ssh service. */
export async function disableSsh(): Promise<void> {
  await execAsync("systemctl disable --now ssh")
}

/** Change a Linux system user's password via chpasswd.
 *  Uses `echo 'user:pass' | sudo chpasswd` — requires root or sudo access. */
export async function changeSystemPassword(username: string, password: string): Promise<void> {
  await execAsync(
    `echo ${safeArg(`${username}:${password}`)} | sudo chpasswd`,
  )
}
