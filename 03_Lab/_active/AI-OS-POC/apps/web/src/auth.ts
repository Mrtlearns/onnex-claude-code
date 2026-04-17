// apps/web/src/auth.ts
// next-auth v5 config — Authentik OIDC with explicit endpoints
// Uses explicit endpoint URLs to bypass wellKnown discovery bug in v5 betas (#13016, #13138)
// Note: auth.ts lives at src/ root, NOT in lib/ (next-auth v5 convention)

import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import { mapGroupsToRole } from "@/lib/rbac"

const AUTHENTIK_ISSUER = process.env.AUTH_AUTHENTIK_ISSUER!
// e.g. "http://authentik-server:9000/application/o/aios"

const authConfig: NextAuthConfig = {
  providers: [
    {
      id: "authentik",
      name: "Authentik",
      type: "oidc",
      issuer: AUTHENTIK_ISSUER,
      clientId: process.env.AUTH_AUTHENTIK_ID,
      clientSecret: process.env.AUTH_AUTHENTIK_SECRET,
      // REQUIRED: bypass wellKnown discovery bug in v5 betas (#13016, #13138)
      // Authentik 2024.10.x uses shared /application/o/authorize/ endpoint
      authorization: {
        url: `${process.env.AUTH_AUTHENTIK_PUBLIC_URL ?? "http://10.10.110.31:9000"}/application/o/authorize/`,
        params: { scope: "openid email profile aios_roles" },
      },
      token: `${AUTHENTIK_ISSUER}/token/`,
      userinfo: `${AUTHENTIK_ISSUER}/userinfo/`,
    },
  ],
  callbacks: {
    // authorized callback: controls whether request is allowed
    // returning false redirects to pages.signIn (the /login page)
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isPublicPath =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/error") ||
        nextUrl.pathname.startsWith("/api/auth")
      // Allow public paths regardless of auth state
      if (isPublicPath) return true
      // Redirect unauthenticated users to login
      if (!isLoggedIn) return false
      return true
    },

    async jwt({ token, account, profile }) {
      // First-time login
      if (account && profile) {
        // Debug: log profile structure to validate groups claim path
        console.log("[auth] profile keys:", Object.keys(profile))
        console.log("[auth] profile.groups:", (profile as Record<string, unknown>).groups)

        const groups = ((profile as Record<string, unknown>).groups as string[]) ?? []
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + ((account.expires_in as number) ?? 3600) * 1000,
          role: mapGroupsToRole(groups),
          tenantId: ((profile as Record<string, unknown>).tenant_id as string) ?? "default",
        }
      }

      // Access token not yet expired
      if (Date.now() < ((token.accessTokenExpires as number) ?? 0)) {
        return token
      }

      // Access token expired — attempt refresh
      try {
        const response = await fetch(`${process.env.AUTH_AUTHENTIK_ISSUER}/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AUTH_AUTHENTIK_ID!,
            client_secret: process.env.AUTH_AUTHENTIK_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        })

        if (!response.ok) throw new Error("Failed to refresh token")

        const refreshed = await response.json()
        return {
          ...token,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
          accessTokenExpires: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
          error: undefined,
        }
      } catch {
        // Signal root layout to trigger signOut
        return { ...token, error: "RefreshAccessTokenError" as const }
      }
    },

    async session({ session, token }) {
      session.user.role = (token.role as string) ?? "team_member"
      session.user.tenantId = (token.tenantId as string) ?? "default"
      session.user.token = (token.accessToken as string) ?? ""
      if (token.error) {
        session.error = token.error as string
      }
      return session
    },
  },
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/error",
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
