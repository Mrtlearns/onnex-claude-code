// apps/web/src/app/(protected)/projects/page.tsx
// Server Component — HydrationBoundary prefetch + ProjectList client component

import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { apiGetProjects } from "@/lib/api-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { ProjectList } from "./components/project-list"
import { Suspense } from "react"

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { status?: string; client_id?: string; archived?: string }
}) {
  const session = await auth()
  const queryClient = getQueryClient()

  const params: Record<string, string | undefined> = {}
  if (searchParams.status && searchParams.status !== "All") params.status = searchParams.status
  if (searchParams.client_id) params.client_id = searchParams.client_id
  if (searchParams.archived) params.archived = searchParams.archived

  if (session?.user.token) {
    await queryClient.prefetchQuery({
      queryKey: ["projects", params],
      queryFn: () => apiGetProjects(session.user.token, params),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <ProjectList initialSearch={searchParams} />
      </Suspense>
    </HydrationBoundary>
  )
}
