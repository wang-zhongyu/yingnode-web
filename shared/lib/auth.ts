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
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  advanced: {
    useSecureCookies: false,
    crossSubdomainCookies: false,
  },
  // 客户端使用 window.location.origin 做同源请求，无需枚举所有 IP
  trustedOrigins: [
    "http://localhost:3000",
    "http://172.16.42.1:3000",
  ],
})
