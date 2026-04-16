import { QueryClient } from "@tanstack/react-query"
import { cache } from "react"

export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          // CRITICAL: prevents double-fetch after server prefetch via HydrationBoundary
          // Without this, every server-prefetched query refetches on client mount
          staleTime: 60 * 1000,
        },
      },
    })
)
