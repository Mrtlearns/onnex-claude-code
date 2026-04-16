import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { apiGetTasks } from "@/lib/api-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { redirect } from "next/navigation"
import { TasksClient } from "./tasks-client"

interface TasksPageProps {
  searchParams: Promise<{
    view?: string
    assignee_id?: string
    project_id?: string
    status?: string
  }>
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await auth()
  if (!session?.user?.token) redirect("/login")

  const params = await searchParams
  const queryClient = getQueryClient()

  const apiParams: Record<string, string | undefined> = {}
  if (params.assignee_id) apiParams.assignee_id = params.assignee_id
  if (params.project_id) apiParams.project_id = params.project_id
  if (params.status) apiParams.status = params.status

  await queryClient.prefetchQuery({
    queryKey: ["tasks", apiParams],
    queryFn: () => apiGetTasks(session.user.token, apiParams),
    staleTime: 60_000,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksClient searchParams={params} />
    </HydrationBoundary>
  )
}
