// apps/web/src/app/(protected)/settings/page.tsx
// Server Component — role-guard (admin/super_admin only) + SSR prefetch workspace settings

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { apiGetWorkspaceSettings } from "@/lib/api-client"
import { SettingsClient } from "./components/settings-client"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
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
      queryKey: ["settings", "workspace"],
      queryFn: () => apiGetWorkspaceSettings(session.user.token),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsClient />
    </HydrationBoundary>
  )
}
