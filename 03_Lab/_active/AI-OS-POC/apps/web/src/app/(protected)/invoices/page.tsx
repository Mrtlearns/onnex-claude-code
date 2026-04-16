// apps/web/src/app/(protected)/invoices/page.tsx
// Server Component — HydrationBoundary prefetch + InvoiceList client component

import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { apiGetInvoices } from "@/lib/api-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { InvoiceList } from "./components/invoice-list"
import { Suspense } from "react"

export default async function InvoicesPage() {
  const session = await auth()
  const queryClient = getQueryClient()

  if (session?.user.token) {
    await queryClient.prefetchQuery({
      queryKey: ["invoices"],
      queryFn: () => apiGetInvoices(session.user.token),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <InvoiceList />
      </Suspense>
    </HydrationBoundary>
  )
}
