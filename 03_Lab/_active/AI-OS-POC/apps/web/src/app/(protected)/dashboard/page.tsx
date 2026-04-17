// apps/web/src/app/(protected)/dashboard/page.tsx
// Server Component — SSR prefetch KPIs + activity via HydrationBoundary

import { auth } from "@/auth"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { apiGetDashboardKpis, apiGetActivity } from "@/lib/api-client"
import { DashboardClient } from "./components/dashboard-client"

export default async function DashboardPage() {
  const session = await auth()
  const queryClient = getQueryClient()

  if (session?.user?.token) {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["dashboard-kpis"],
        queryFn: () => apiGetDashboardKpis(session.user.token),
      }),
      queryClient.prefetchQuery({
        queryKey: ["activity"],
        queryFn: () => apiGetActivity(session.user.token),
      }),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient session={session} />
    </HydrationBoundary>
  )
}
