import { z } from "zod"

const noNewlines = (field: string) =>
  z.string().refine((v) => !v.includes("\n") && !v.includes("\r"), {
    message: `${field} 不能包含换行符`,
  })

export const deviceConfigSchema = z.object({
  wifiInterface: z
    .string()
    .min(1)
    .max(15)
    .regex(/^[a-zA-Z0-9_:-]+$/, "接口名只能包含字母、数字、_、:、-")
    .optional(),
  hotspotIp: z
    .string()
    .regex(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
      "Must be a valid IPv4 address",
    )
    .optional(),
  hotspotSsid: z
    .string()
    .min(1)
    .max(32)
    .pipe(noNewlines("SSID"))
    .optional(),
  hotspotPassword: z
    .string()
    .min(8, "密码至少 8 位")
    .max(63, "密码最多 63 位")
    .pipe(noNewlines("密码"))
    .optional()
    .or(z.literal("")),
})

export type DeviceConfigInput = z.infer<typeof deviceConfigSchema>
