'use client'
import { SessionProvider } from 'next-auth/react'
import { ApolloProviderWrapper } from '@/lib/apollo-provider'
import { Navbar } from '@/components/Navbar'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ApolloProviderWrapper>
        <Navbar />
        {children}
      </ApolloProviderWrapper>
    </SessionProvider>
  )
}
