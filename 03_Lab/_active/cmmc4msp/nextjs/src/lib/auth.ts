import type { NextAuthOptions } from 'next-auth'

/**
 * Resolve the caller's DB users.id (UUID) from email.
 *
 * Why: Authentik JWT `sub` for seeded demo users is an integer pk string
 * (e.g. "9"), not a UUID. Hasura's `users.id` and all `assigned_to` FKs
 * are UUIDs, so we must resolve email → users.id on sign-in and cache
 * on the JWT. Gracefully returns null if the user has no DB row yet
 * (new Authentik user who hasn't been provisioned) — callers fall
 * back to `sub`, matching existing behavior.
 */
async function resolveDbUserId(email: string): Promise<string | null> {
  const adminSecret = process.env.HASURA_ADMIN_SECRET
  if (!adminSecret || !email) return null
  const base = (process.env.HASURA_INTERNAL_URL || process.env.NEXT_PUBLIC_HASURA_URL || '').replace(/\/$/, '')
  if (!base) return null
  const endpoint = base.endsWith('/v1/graphql') ? base : `${base}/v1/graphql`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': adminSecret,
      },
      body: JSON.stringify({
        query: 'query($email: String!) { users(where: { email: { _eq: $email } }, limit: 1) { id } }',
        variables: { email },
      }),
    })
    if (!res.ok) {
      console.error('[auth] resolveDbUserId HTTP', res.status)
      return null
    }
    const body = await res.json()
    return body?.data?.users?.[0]?.id ?? null
  } catch (err) {
    console.error('[auth] resolveDbUserId error:', err)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function refreshAuthentikToken(token: any): Promise<any> {
  if (!token.refreshToken) return { ...token, error: 'NoRefreshToken' }

  try {
    const issuer = (process.env.AUTHENTIK_ISSUER || '').replace(/\/$/, '')
    const res = await fetch(`${issuer}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: process.env.AUTHENTIK_CLIENT_ID!,
        client_secret: process.env.AUTHENTIK_CLIENT_SECRET!,
        scope: 'openid email profile cmmc',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[auth] Token refresh failed:', res.status, body)
      return { ...token, error: 'RefreshFailed' }
    }

    const refreshed = await res.json()
    return {
      ...token,
      idToken: refreshed.id_token || refreshed.access_token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      error: undefined,
    }
  } catch (err) {
    console.error('[auth] Token refresh error:', err)
    return { ...token, error: 'RefreshError' }
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'authentik',
      name: 'Authentik',
      type: 'oauth',
      clientId: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
      issuer: process.env.AUTHENTIK_ISSUER!,
      wellKnown: `${process.env.AUTHENTIK_ISSUER}.well-known/openid-configuration`,
      authorization: { params: { scope: 'openid email profile cmmc' } },
      idToken: true,
      checks: ['pkce', 'state'] as any,
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name || profile.email,
          email: profile.email,
          org_id: profile.org_id || '',
          msp_id: profile.msp_id || '',
          role: profile.role || 'client_user',
        }
      },
    },
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account, profile }: any) {
      // Initial sign-in — store all tokens, expiry, and resolved DB user id
      if (account && profile) {
        const dbUserId = await resolveDbUserId(profile.email)
        return {
          ...token,
          idToken: account.id_token || account.access_token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          // expires_at from OAuth is UNIX seconds; store as ms with a 60s buffer
          expiresAt: account.expires_at
            ? account.expires_at * 1000 - 60_000
            : Date.now() + 3540_000,
          org_id: profile.org_id || '',
          msp_id: profile.msp_id || '',
          role: profile.role || 'client_user',
          dbUserId,
          email: profile.email,
        }
      }

      // Late-resolve: if dbUserId missing and we haven't tried yet, attempt once.
      // dbUserIdResolved flag prevents repeated Hasura calls on every jwt refresh.
      if (!token.dbUserId && !token.dbUserIdResolved && token.email) {
        token.dbUserId = await resolveDbUserId(token.email)
        token.dbUserIdResolved = true
      }

      // Token still valid — return as-is
      if (Date.now() < (token.expiresAt ?? 0)) return token

      // Token expired — refresh
      return refreshAuthentikToken(token)
    },

    async session({ session, token }: any) {
      if (session.user) {
        ;(session.user as any).accessToken = token.idToken || token.accessToken
        ;(session.user as any).org_id = token.org_id
        ;(session.user as any).msp_id = token.msp_id
        ;(session.user as any).role = token.role
        // Prefer resolved DB UUID for queries against users.id / assigned_to.
        // Fall back to JWT sub for brand-new Authentik users without a DB row yet.
        ;(session.user as any).id = token.dbUserId || token.sub
        ;(session.user as any).sub = token.sub
        ;(session.user as any).tokenError = token.error
      }
      return session
    },
  },
}
