import { redirect } from "next/navigation"
import { auth } from "@/shared/lib/auth"
import { checkUsersExist } from "@/features/auth/lib/check-users-exist"
import { headers } from "next/headers"

export default async function RootPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect("/network")
  }

  const usersExist = await checkUsersExist()
  if (!usersExist) {
    redirect("/setup")
  }

  redirect("/login")
}
