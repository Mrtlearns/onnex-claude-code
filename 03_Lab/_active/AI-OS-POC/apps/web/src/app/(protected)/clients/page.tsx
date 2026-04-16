// apps/web/src/app/(protected)/clients/page.tsx
// Server Component — HydrationBoundary prefetch + ClientList client component
// Pattern: prefetch on server -> HydrationBoundary -> Client Component reads hydrated cache

import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { apiGetClients } from "@/lib/api-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { ClientList } from "./components/client-list"
import { Suspense } from "react"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; archived?: string }
}) {
  const session = await auth()
  const queryClient = getQueryClient()

  // Build params for prefetch matching client-list.tsx useQuery key
  const params: Record<string, string | undefined> = {}
  if (searchParams.q) params.q = searchParams.q
  if (searchParams.status && searchParams.status !== "All") params.status = searchParams.status
  if (searchParams.archived) params.archived = searchParams.archived

  if (session?.user.token) {
    await queryClient.prefetchQuery({
      queryKey: ["clients", params],
      queryFn: () => apiGetClients(session.user.token, params),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <ClientList initialSearch={searchParams} />
      </Suspense>
    </HydrationBoundary>
  )
}
