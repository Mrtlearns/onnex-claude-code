// apps/web/src/app/(protected)/reports/page.tsx
// Server Component — SSR prefetch utilization report (default) via HydrationBoundary

import { auth } from "@/auth"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { apiGetUtilizationReport } from "@/lib/api-client"
import { ReportsClient } from "./components/reports-client"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const session = await auth()
  const queryClient = getQueryClient()

  if (session?.user?.token) {
    await queryClient.prefetchQuery({
      queryKey: ["report", "utilization", "this_month", undefined, undefined],
      queryFn: () =>
        apiGetUtilizationReport(session.user.token, { period: "this_month" }),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReportsClient session={session} />
    </HydrationBoundary>
  )
}
