import { z } from "zod"

export const historyQuerySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(1440).default(60),
})

export const processesQuerySchema = z.object({
  sort: z.enum(["cpu", "mem"]).default("cpu"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
