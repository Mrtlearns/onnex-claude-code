import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { apiGetDeals } from "@/lib/api-client"
import { redirect } from "next/navigation"
import { DealsPipeline } from "./components/deals-pipeline"

export default async function DealsPage() {
  const session = await auth()
  if (!session?.user?.token) redirect("/login")

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["deals"],
    queryFn: () => apiGetDeals(session.user.token),
    staleTime: 60_000,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DealsPipeline />
    </HydrationBoundary>
  )
}
