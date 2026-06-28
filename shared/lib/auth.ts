import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/shared/lib/prisma"

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendOnSignUp: false,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "user",
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  // The device serves over HTTP on a local network — secure cookies would be
  // rejected by browsers and break authentication entirely.
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  advanced: {
    useSecureCookies: false,
    crossSubDomainCookies: { enabled: false },
  },
  // 设备运行在局域网 HTTP 环境，IP 可能变化（DHCP 分配或热点 IP）
  // 使用函数动态返回可信 origin，避免硬编码所有可能的 IP
  trustedOrigins: (request?: Request) => {
    const origin = request?.headers.get("origin") ?? ""
    try {
      const url = new URL(origin)
      // Trust localhost
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return [origin]
      }
      // Trust any private network IP (RFC 1918) over HTTP — the device is
      // always accessed locally, never exposed to the public internet
      if (url.protocol === "http:") {
        const parts = url.hostname.split(".").map(Number)
        if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
          // 10.0.0.0/8
          if (parts[0] === 10) return [origin]
          // 172.16.0.0/12
          if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return [origin]
          // 192.168.0.0/16
          if (parts[0] === 192 && parts[1] === 168) return [origin]
        }
      }
    } catch { /* invalid origin — reject */ }
    return []
  },
})
