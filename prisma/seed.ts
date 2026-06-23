import "dotenv/config"
import { resolve } from "path"
import { PrismaClient } from "../lib/generated/prisma/client.js"
import { PrismaLibSql } from "@prisma/adapter-libsql"

const dbPath = resolve(process.env.DATABASE_URL?.replace("file:", "") ?? "./dev.db")
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.networkStatus.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      status: "ONLINE",
      hotspotActive: false,
    },
  })
  console.log("Seed: NetworkStatus initialized")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
