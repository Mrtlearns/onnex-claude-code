// apps/web/src/types/next-auth.d.ts
// Session type augmentation — adds role, tenantId, and token to session.user

import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: string
      tenantId: string
      token: string // raw Authentik access token — used as Bearer header for aios-api calls
    }
    error?: string
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string
    tenantId?: string
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}
