/**
 * Manual hotspot lock — prevents the network monitor from auto-starting
 * or auto-stopping the hotspot while a manual WiFi connection is in progress.
 *
 * Used by the connect-from-hotspot flow. The lock is always released in
 * a finally block, so no timeout is needed.
 */

let manualHotspotLock = false

export function setManualHotspotLock(locked: boolean): void {
  manualHotspotLock = locked
}

export function isManualHotspotLocked(): boolean {
  return manualHotspotLock
}
