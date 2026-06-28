import { NextRequest, NextResponse } from "next/server"

const TTYD_PORT = 3001

// ponytail: require explicit env — no hardcoded fallback that leaks credentials
function getTtydAuth(): string {
  const token = process.env.TERMINAL_TOKEN
  if (!token) {
    throw new Error("TERMINAL_TOKEN environment variable is required")
  }
  return `yingnode:${token}`
}

// In-memory token store with TTL
const tokenStore = new Map<string, { auth: string; expiresAt: number }>()
const TOKEN_TTL_MS = 300_000 // 5 minutes

// Garbage-collect expired tokens periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of tokenStore) {
    if (data.expiresAt < now) tokenStore.delete(token)
  }
}, 300_000)

/** Create a short-lived session token for terminal access.
 *  The credential is NEVER returned in this response. */
export async function GET() {
  const token = crypto.randomUUID()

  let auth: string
  try {
    auth = getTtydAuth()
  } catch {
    return NextResponse.json(
      { error: "Terminal not configured" },
      { status: 500 },
    )
  }

  tokenStore.set(token, { auth, expiresAt: Date.now() + TOKEN_TTL_MS })

  return NextResponse.json({
    url: `http://localhost:${TTYD_PORT}`,
    token,
    expiresIn: TOKEN_TTL_MS,
  })
}

/** Validate a token and return the auth credential.
 *  The token is consumed (deleted) after successful validation. */
export async function POST(request: NextRequest) {
  let token: unknown
  try {
    const body = await request.json()
    token = body?.token
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  const data = tokenStore.get(token)
  if (!data || data.expiresAt < Date.now()) {
    if (data) tokenStore.delete(token)
    return NextResponse.json({ error: "Token expired or invalid" }, { status: 401 })
  }

  // Construct response before deleting token so the credential is
  // serialized even if the HTTP response delivery later fails
  const response = NextResponse.json({ auth: data.auth })
  tokenStore.delete(token)
  return response
}
