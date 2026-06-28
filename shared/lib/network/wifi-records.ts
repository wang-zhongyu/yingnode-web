import { prisma } from "@/shared/lib/prisma"
import { execAsync, safeArg } from "@/shared/lib/shell"
import type { NetworkServiceState } from "./constants"
import { getStatus } from "./db-status"

/** Sync WiFi networks from wpa_supplicant into the database.
 *  Uses wpa_cli list_networks to read saved networks from the WiFi interface. */
export async function syncWpaSupplicantNetworks(state: NetworkServiceState): Promise<void> {
  try {
    const { wifiInterface } = await state.getConfig()
    const { stdout } = await execAsync(
      `wpa_cli -i ${safeArg(wifiInterface)} list_networks`,
      5000,
    )
    const lines = stdout.split("\n").slice(1)
    for (const line of lines) {
      const parts = line.split("\t")
      if (parts.length < 2) continue
      const id = parseInt(parts[0], 10)
      const ssid = parts[1]
      if (isNaN(id) || !ssid || ssid === "\\x00") continue
      try {
        const existing = await prisma.wiFiRecord.findUnique({ where: { ssid } })
        if (!existing) {
          await prisma.wiFiRecord.create({ data: { ssid, security: "WPA2" } })
        }
      } catch {
        // skip duplicates or DB errors silently
      }
    }
  } catch {
    // wpa_cli may not be available — that's ok
  }
}

/** Read all saved WiFi records from the database. */
export async function getSavedWiFi(
  state: NetworkServiceState,
): Promise<
  Array<{
    id: number
    ssid: string
    security: string
    networkId: number | null
    addedAt: string
    lastUsed: string | null
  }>
> {
  await syncWpaSupplicantNetworks(state)
  const records = await prisma.wiFiRecord.findMany({
    orderBy: { addedAt: "desc" },
  })
  return records.map((r) => ({
    id: r.id,
    ssid: r.ssid,
    security: r.security,
    networkId: r.networkId,
    addedAt: r.addedAt.toISOString(),
    lastUsed: r.lastUsed?.toISOString() ?? null,
  }))
}

/** Find the wpa_cli network ID for a given SSID. Returns null if not found. */
export async function getWpaNetworkId(
  ssid: string,
  iface: string,
): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `wpa_cli -i ${safeArg(iface)} list_networks`,
    )
    const lines = stdout.split("\n").slice(1)
    for (const line of lines) {
      const parts = line.split("\t")
      if (parts.length < 2) continue
      const id = parseInt(parts[0], 10)
      const name = parts[1]
      if (!isNaN(id) && name === ssid) return id
    }
    return null
  } catch {
    return null
  }
}

/** Remove a saved WiFi network from both wpa_supplicant and the database.
 *  Loads the record by id to get the authoritative SSID — the caller cannot
 *  specify a different SSID than the one stored for this record. */
export async function forgetWiFi(state: NetworkServiceState, id: number): Promise<boolean> {
  const record = await prisma.wiFiRecord.findUnique({ where: { id } })
  if (!record) {
    throw new Error("WiFi record not found")
  }

  const { wifiInterface } = await state.getConfig()

  // Check if this is the currently-connected SSID
  const status = await getStatus()
  const isCurrentConnection = status.currentSSID === record.ssid

  try {
    const networkId = await getWpaNetworkId(record.ssid, wifiInterface)
    if (networkId !== null) {
      await execAsync(
        `wpa_cli -i ${safeArg(wifiInterface)} remove_network ${networkId}`,
      )
      // If this was the active connection, disconnect so the monitor
      // detects offline and starts the hotspot within ~10s
      if (isCurrentConnection) {
        try {
          await execAsync(`wpa_cli -i ${safeArg(wifiInterface)} disconnect`)
        } catch { /* interface may already be down */ }
      }
      await execAsync(`wpa_cli -i ${safeArg(wifiInterface)} save_config`)
    }
  } catch (err) {
    console.warn(
      `[network] Failed to remove wpa_cli network for "${record.ssid}":`,
      err,
    )
  }

  await prisma.wiFiRecord.delete({ where: { id } })
  return true
}
