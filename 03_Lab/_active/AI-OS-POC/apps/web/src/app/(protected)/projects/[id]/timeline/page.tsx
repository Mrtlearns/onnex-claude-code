// apps/web/src/app/(protected)/projects/[id]/timeline/page.tsx
// Server Component — project Gantt timeline view

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getQueryClient } from "@/lib/query-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { ProjectTimelineClient } from "./timeline-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectTimelinePage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.token) redirect("/login")
  const { id } = await params

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ProjectTimelineClient projectId={id} />
    </HydrationBoundary>
  )
}
