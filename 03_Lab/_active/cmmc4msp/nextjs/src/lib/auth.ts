import type { NextAuthOptions } from 'next-auth'

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
      // Initial sign-in — store all tokens and expiry
      if (account && profile) {
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
        }
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
        ;(session.user as any).id = token.sub
        ;(session.user as any).tokenError = token.error
      }
      return session
    },
  },
}
