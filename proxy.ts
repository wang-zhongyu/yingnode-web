import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/shared/lib/auth"
import { checkUsersExist } from "@/features/auth/lib/check-users-exist"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  const isAuthenticated = session !== null && session !== undefined

  // Root path — redirect based on auth state
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/monitoring", request.url))
    }

    try {
      const usersExist = await checkUsersExist()
      if (!usersExist) {
        return NextResponse.redirect(new URL("/setup", request.url))
      }
    } catch {
      // DB unavailable — allow access rather than block completely
      console.error("[proxy] Failed to check users exist")
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // /setup — only accessible when no users exist and not authenticated
  if (pathname.startsWith("/setup")) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/monitoring", request.url))
    }

    try {
      const usersExist = await checkUsersExist()
      if (usersExist) {
        return NextResponse.redirect(new URL("/login", request.url))
      }
    } catch {
      console.error("[proxy] Failed to check users exist for /setup")
    }

    return NextResponse.next()
  }

  // /login — redirect to dashboard if already authenticated
  if (pathname.startsWith("/login")) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/monitoring", request.url))
    }
    return NextResponse.next()
  }

  // Protected routes: /(dashboard) and /(settings)
  const isProtectedRoute =
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/apps") ||
    pathname.startsWith("/docker") ||
    pathname.startsWith("/settings")

  if (isProtectedRoute) {
    if (!isAuthenticated) {
      try {
        const usersExist = await checkUsersExist()
        if (!usersExist) {
          return NextResponse.redirect(new URL("/setup", request.url))
        }
      } catch {
        console.error("[proxy] Failed to check users exist for protected route")
      }
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // API routes: require authentication (except /api/auth which is excluded by matcher, and /api/health)
  if (pathname.startsWith("/api/")) {
    // Health check endpoint is public
    if (pathname === "/api/health") {
      return NextResponse.next()
    }
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
}
