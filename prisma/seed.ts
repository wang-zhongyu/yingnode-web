import "dotenv/config"
import { resolve } from "path"
import { PrismaClient } from "../lib/generated/prisma/client.js"
import { PrismaLibSql } from "@prisma/adapter-libsql"

const dbPath = resolve(process.env.DATABASE_URL?.replace("file:", "") ?? "./dev.db")
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function seedNetworkStatus() {
  await prisma.networkStatus.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      status: "ONLINE",
      hotspotActive: false,
    },
  })
  console.log("✓ NetworkStatus initialized")
}

async function seedAdminUser() {
  const userCount = await prisma.user.count()
  if (userCount > 0) {
    console.log("✓ Users already exist, skipping admin seed")
    return
  }

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    console.log("ℹ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping admin seed")
    return
  }

  // Use better-auth API for proper password hashing
  const { auth } = await import("../shared/lib/auth.js")

  const result = await auth.api.signUpEmail({
    body: {
      name: email.split("@")[0] ?? "Admin",
      email,
      password,
      role: "admin",
    },
    headers: new Headers(),
  })

  if (result) {
    console.log(`✓ Admin user created: ${email}`)
  } else {
    console.error("✗ Failed to create admin user")
  }
}

async function main() {
  console.log("Seeding database...\n")
  await seedNetworkStatus()
  await seedAdminUser()
  console.log("\nSeed complete.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
