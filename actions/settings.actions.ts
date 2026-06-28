"use server"

import { actionClient, authActionClient } from "@/shared/lib/safe-action"
import { deviceConfigSchema } from "@/features/settings/schemas/device-config.schema"
import { prisma } from "@/shared/lib/prisma"
import { networkService } from "@/shared/lib/network-service"

export const updateDeviceConfigAction = authActionClient
  .schema(deviceConfigSchema)
  .action(async ({ parsedInput }) => {
    await prisma.deviceConfig.upsert({
      where: { id: 1 },
      update: parsedInput,
      create: { id: 1, ...parsedInput },
    })
    networkService.clearConfigCache()
    return { success: true }
  })
