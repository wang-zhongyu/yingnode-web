/**
 * Manual hotspot lock — prevents the network monitor from auto-starting
 * or auto-stopping the hotspot while a manual operation is in progress.
 *
 * Used by the connect-from-hotspot flow: the API route locks before
 * stopping the hotspot to connect WiFi, and unlocks in its finally block.
 * A 90s auto-clear timeout is the safety net if the route handler crashes.
 */

let manualHotspotLock = false
let lockTimeout: ReturnType<typeof setTimeout> | null = null

const AUTO_CLEAR_MS = 90_000 // 90s safety net

export function setManualHotspotLock(locked: boolean): void {
  manualHotspotLock = locked

  if (lockTimeout) {
    clearTimeout(lockTimeout)
    lockTimeout = null
  }

  if (locked) {
    lockTimeout = setTimeout(() => {
      console.warn(
        "[hotspot-lock] Lock auto-cleared after 90s — this indicates the API route did not release it",
      )
      manualHotspotLock = false
      lockTimeout = null
    }, AUTO_CLEAR_MS)
  }
}

export function isManualHotspotLocked(): boolean {
  return manualHotspotLock
}
