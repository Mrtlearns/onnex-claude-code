"use client"
import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { SessionProvider } from "next-auth/react"

// Client-side QueryClient -- created once per client session via useState
// Server-side prefetching uses getQueryClient() from @/lib/query-client (React cache() singleton)
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // CRITICAL: prevents double-fetch after server prefetch via HydrationBoundary
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getClientQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  // NOTE: Avoid useState when using SSR+streaming -- see TanStack Query docs
  // Using module-level singleton for browser; new instance for server renders
  const queryClient = getClientQueryClient()

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </SessionProvider>
  )
}
