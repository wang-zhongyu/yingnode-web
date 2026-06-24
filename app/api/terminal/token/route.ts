import { NextResponse } from "next/server"

// ttyd is a standalone Web TTY daemon. It listens on localhost:3001
// and serves its own xterm.js UI. We embed it via iframe.
// Auth: ttyd supports -c user:pass for Basic Auth; we use the
// TERMINAL_TOKEN env var for the password.
const TTYD_PORT = 3001
const TTYD_AUTH = `yingnode:${process.env.TERMINAL_TOKEN ?? "yingnode-terminal"}`

export async function GET() {
  return NextResponse.json({
    url: `http://${TTYD_AUTH}@localhost:${TTYD_PORT}`,
  })
}
