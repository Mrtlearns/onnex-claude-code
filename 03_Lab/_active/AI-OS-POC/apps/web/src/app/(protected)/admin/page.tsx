// apps/web/src/app/(protected)/admin/page.tsx
// Server Component — role-guard + SSR prefetch audit log + HydrationBoundary

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { apiGetAuditLog } from "@/lib/api-client"
import { AdminClient } from "./components/admin-client"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/dashboard")
  }

  const role = (session.user as { role?: string }).role
  if (!role || !["admin", "super_admin"].includes(role)) {
    redirect("/dashboard")
  }

  const queryClient = getQueryClient()

  if (session.user.token) {
    await queryClient.prefetchQuery({
      queryKey: ["audit-log"],
      queryFn: () => apiGetAuditLog(session.user.token),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminClient session={session} />
    </HydrationBoundary>
  )
}
