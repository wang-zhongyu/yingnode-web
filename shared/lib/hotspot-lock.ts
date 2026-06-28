/**
 * Manual hotspot lock — prevents the network monitor from auto-starting
 * or auto-stopping the hotspot while a manual WiFi connection is in progress.
 *
 * Stored in the database (NetworkStatus.manualLock) rather than in-process
 * memory because Next.js Server Actions and instrumentation run in separate
 * workers — an in-memory boolean is not visible across worker boundaries.
 */

import { prisma } from "@/shared/lib/prisma"

export async function setManualHotspotLock(locked: boolean): Promise<void> {
  try {
    await prisma.networkStatus.upsert({
      where: { id: 1 },
      update: { manualLock: locked },
      create: { id: 1, manualLock: locked },
    })
  } catch {
    // Non-fatal — if DB is unreachable, monitor defaults to safe behavior
  }
}

export async function isManualHotspotLocked(): Promise<boolean> {
  try {
    const record = await prisma.networkStatus.findFirst({ where: { id: 1 } })
    return record?.manualLock ?? false
  } catch {
    return false
  }
}
