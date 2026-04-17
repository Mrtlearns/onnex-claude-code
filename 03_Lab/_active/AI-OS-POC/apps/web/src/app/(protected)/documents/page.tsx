// apps/web/src/app/(protected)/documents/page.tsx
// Server Component — no server-side prefetch (Paperless/Nextcloud are external, fetched client-side)

import { auth } from "@/auth"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { DocumentsClient } from "./components/documents-client"

export default async function DocumentsPage() {
  const session = await auth()
  const queryClient = getQueryClient()
  // Note: Paperless/Nextcloud lists are fetched client-side via BFF (not prefetched server-side)
  // because they go to external services which may be slow
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DocumentsClient session={session} />
    </HydrationBoundary>
  )
}
