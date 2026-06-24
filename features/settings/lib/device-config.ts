import { prisma } from "@/shared/lib/prisma"

const FALLBACK = {
  wifiInterface: process.env.WIFI_INTERFACE ?? "wlan0",
  hotspotIp: process.env.HOTSPOT_IP ?? "172.16.42.1",
  hotspotSsid: process.env.HOTSPOT_SSID ?? "yingnode",
  hotspotPassword: process.env.HOTSPOT_PASSWORD ?? "",
}

export async function getDeviceConfig() {
  try {
    const config = await prisma.deviceConfig.findFirst({ where: { id: 1 } })
    return {
      wifiInterface: config?.wifiInterface ?? FALLBACK.wifiInterface,
      hotspotIp: config?.hotspotIp ?? FALLBACK.hotspotIp,
      hotspotSsid: config?.hotspotSsid ?? FALLBACK.hotspotSsid,
      hotspotPassword: config?.hotspotPassword ?? FALLBACK.hotspotPassword,
    }
  } catch {
    // prisma not initialized (edge runtime) or table missing — return env fallback
    return { ...FALLBACK }
  }
}
