"use client"
// apps/web/src/app/(protected)/dashboard/components/team-workload.tsx
// Team workload panel — visible only to manager/admin/super_admin
// Query is disabled (not even sent) for non-manager roles

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Session } from "next-auth"
import type { TeamWorkloadItem } from "@/types/api"

interface TeamWorkloadProps {
  session: Session | null
}

export function TeamWorkload({ session }: TeamWorkloadProps) {
  const isManagerOrAdmin = ["manager", "admin", "super_admin"].includes(
    session?.user?.role ?? "",
  )

  const { data, isLoading } = useQuery<TeamWorkloadItem[]>({
    queryKey: ["team-workload"],
    queryFn: () => fetch("/api/bff/dashboard/team-workload").then((r) => r.json()),
    enabled: isManagerOrAdmin,
  })

  // Non-manager/admin roles see nothing
  if (!isManagerOrAdmin) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Team Workload</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-2">No workload data</p>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground pb-1 border-b">
              <span>Assignee</span>
              <span className="text-right">Tasks</span>
              <span className="text-right">Hrs/wk</span>
            </div>
            {data.map((item) => (
              <div key={item.assignee_id} className="grid grid-cols-3 text-sm">
                <span className="truncate text-xs text-muted-foreground" title={item.assignee_id}>
                  {item.assignee_id.slice(0, 8)}...
                </span>
                <span className="text-right font-medium">{item.task_count}</span>
                <span className="text-right text-muted-foreground">{item.hours_this_week}h</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
