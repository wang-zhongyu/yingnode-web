import { z } from "zod"

export const manualAddSchema = z.object({
  ssid: z.string().min(1, "网络名称不能为空"),
  password: z.string().optional(),
  security: z.enum(["WPA2", "WPA", "OPEN"]),
})

export type ManualAddInput = z.infer<typeof manualAddSchema>

export const connectFromHotspotSchema = z.object({
  ssid: z.string().min(1, "网络名称不能为空"),
  password: z.string().optional(),
  security: z.enum(["WPA2", "WPA", "OPEN"]),
})

export type ConnectFromHotspotInput = z.infer<typeof connectFromHotspotSchema>
