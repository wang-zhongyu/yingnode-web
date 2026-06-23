import { prisma } from "@/shared/lib/prisma"

export async function checkUsersExist(): Promise<boolean> {
  const count = await prisma.user.count()
  return count > 0
}
