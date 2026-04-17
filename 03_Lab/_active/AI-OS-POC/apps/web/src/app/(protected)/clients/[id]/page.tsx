// apps/web/src/app/(protected)/clients/[id]/page.tsx
// Server Component — client detail with contacts + linked projects

import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { apiGetClient, apiGetProjects } from "@/lib/api-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { ClientDetailClient } from "./client-detail-client"
import { notFound } from "next/navigation"

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  const queryClient = getQueryClient()

  if (!session?.user.token) {
    return null
  }

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["client", params.id],
        queryFn: () => apiGetClient(session.user.token, params.id),
      }),
      queryClient.prefetchQuery({
        queryKey: ["projects", { client_id: params.id }],
        queryFn: () => apiGetProjects(session.user.token, { client_id: params.id }),
      }),
    ])
  } catch {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientDetailClient clientId={params.id} />
    </HydrationBoundary>
  )
}
