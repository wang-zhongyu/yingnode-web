import { z } from "zod"

export const deviceConfigSchema = z.object({
  wifiInterface: z.string().min(1).optional(),
  hotspotIp: z
    .string()
    .regex(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
      "Must be a valid IPv4 address",
    )
    .optional(),
  hotspotSsid: z.string().min(1).max(32).optional(),
})

export type DeviceConfigInput = z.infer<typeof deviceConfigSchema>
