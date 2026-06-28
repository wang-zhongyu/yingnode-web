import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/shared/lib/auth"
import { checkUsersExist } from "@/features/auth/lib/check-users-exist"

async function getAuthState(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  return session !== null && session !== undefined
}

async function redirectToSetupIfNoUsers(request: NextRequest, fallback: string) {
  try {
    const usersExist = await checkUsersExist()
    if (!usersExist) {
      return NextResponse.redirect(new URL("/setup", request.url))
    }
  } catch {
    console.error("[proxy] Failed to check users exist")
  }
  return NextResponse.redirect(new URL(fallback, request.url))
}

async function handleRoot(request: NextRequest, isAuthenticated: boolean) {
  // Authenticated → monitoring
  if (isAuthenticated) {
    return NextResponse.redirect(new URL("/monitoring", request.url))
  }
  return redirectToSetupIfNoUsers(request, "/login")
}

async function handleSetup(request: NextRequest, isAuthenticated: boolean) {
  // Already authenticated → monitoring
  if (isAuthenticated) {
    return NextResponse.redirect(new URL("/monitoring", request.url))
  }
  // Check if setup is still needed
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

async function handleProtectedRoute(request: NextRequest, isAuthenticated: boolean) {
  if (isAuthenticated) return NextResponse.next()
  return redirectToSetupIfNoUsers(request, "/login")
}

function handleApiRoute(request: NextRequest, isAuthenticated: boolean) {
  // Health check is public
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next()
  }
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.next()
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthenticated = await getAuthState(request)

  // Root path
  if (pathname === "/") return handleRoot(request, isAuthenticated)

  // /setup — only accessible when no users exist and not authenticated
  if (pathname.startsWith("/setup")) return handleSetup(request, isAuthenticated)

  // /login — redirect authenticated users to monitoring
  if (pathname.startsWith("/login")) {
    if (isAuthenticated) return NextResponse.redirect(new URL("/monitoring", request.url))
    return NextResponse.next()
  }

  // Protected routes: /monitoring, /apps, /docker, /settings
  const isProtected =
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/apps") ||
    pathname.startsWith("/docker") ||
    pathname.startsWith("/settings")

  if (isProtected) return handleProtectedRoute(request, isAuthenticated)

  // API routes (except /api/auth which is excluded by matcher)
  if (pathname.startsWith("/api/")) return handleApiRoute(request, isAuthenticated)

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
}
