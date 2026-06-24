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
  hotspotPassword: z
    .string()
    .min(8, "密码至少 8 位")
    .max(63, "密码最多 63 位")
    .optional()
    .or(z.literal("")),
})

export type DeviceConfigInput = z.infer<typeof deviceConfigSchema>
