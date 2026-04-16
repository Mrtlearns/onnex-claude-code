import type { NextAuthOptions } from 'next-auth'

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
      // Include 'cmmc' scope to trigger the CMMC claims property mapping
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
      if (account && profile) {
        token.accessToken = account.access_token
        // id_token always carries custom CMMC claims (role, org_id, msp_id)
        // Use it for FastAPI Bearer auth since access_token may lack custom claims
        token.idToken = account.id_token || account.access_token
        token.org_id = profile.org_id || ''
        token.msp_id = profile.msp_id || ''
        token.role = profile.role || 'client_user'
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        // Apollo client and API calls use idToken (has CMMC claims) for Bearer auth
        ;(session.user as any).accessToken = token.idToken || token.accessToken
        ;(session.user as any).org_id = token.org_id
        ;(session.user as any).msp_id = token.msp_id
        ;(session.user as any).role = token.role
        ;(session.user as any).id = token.sub
      }
      return session
    },
  },
}
