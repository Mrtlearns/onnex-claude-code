// apps/web/src/app/(protected)/projects/[id]/page.tsx
// Server Component — project detail with tasks count + budget + phases + logged hours

import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { apiGetProject, apiGetTimeEntries } from "@/lib/api-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { ProjectDetailClient } from "./project-detail-client"
import { notFound } from "next/navigation"

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  const queryClient = getQueryClient()

  if (!session?.user.token) return null

  try {
    await queryClient.prefetchQuery({
      queryKey: ["project", params.id],
      queryFn: () => apiGetProject(session.user.token, params.id),
    })
  } catch {
    notFound()
  }

  // Prefetch time entries for logged hours KPI — non-blocking
  try {
    await queryClient.prefetchQuery({
      queryKey: ["time-entries", { project_id: params.id }],
      queryFn: () => apiGetTimeEntries(session.user.token, { project_id: params.id }),
    })
  } catch {
    // silently proceed — client will fetch on mount
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectDetailClient projectId={params.id} />
    </HydrationBoundary>
  )
}
