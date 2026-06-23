import { PrismaClient } from "@/lib/generated/prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { resolve } from "path"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient(): PrismaClient {
  const dbPath = resolve(process.env.DATABASE_URL?.replace("file:", "") ?? "./dev.db")
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
