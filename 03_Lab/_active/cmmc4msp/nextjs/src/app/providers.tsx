'use client'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { ApolloProviderWrapper } from '@/lib/apollo-provider'
import { Navbar } from '@/components/Navbar'
import { useEffect } from 'react'

function TokenErrorGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  useEffect(() => {
    const err = (session?.user as any)?.tokenError
    if (err) {
      console.warn('[auth] token error, forcing re-login:', err)
      signOut({ callbackUrl: '/api/auth/signin' })
    }
  }, [session])
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TokenErrorGuard>
        <ApolloProviderWrapper>
          <Navbar />
          {children}
        </ApolloProviderWrapper>
      </TokenErrorGuard>
    </SessionProvider>
  )
}
