import { prisma } from "@/shared/lib/prisma"
import type { NetworkStatus } from "@/shared/types/network"

export async function getStatus(): Promise<NetworkStatus> {
  const record = await prisma.networkStatus.findFirst({ where: { id: 1 } })
  if (!record) {
    return {
      status: "ONLINE",
      hotspotActive: false,
      lastCheck: new Date().toISOString(),
      currentSSID: null,
      ipAddress: null,
      reachableIp: null,
    }
  }
  return {
    status: record.status as NetworkStatus["status"],
    hotspotActive: record.hotspotActive,
    lastCheck: record.lastCheck.toISOString(),
    currentSSID: record.currentSSID,
    ipAddress: record.ipAddress,
    reachableIp: null,
  }
}

export async function updateDB(fields: Record<string, unknown>): Promise<void> {
  await prisma.networkStatus.upsert({
    where: { id: 1 },
    update: { ...fields, lastCheck: new Date() },
    create: { id: 1, ...fields, lastCheck: new Date() },
  })
}
