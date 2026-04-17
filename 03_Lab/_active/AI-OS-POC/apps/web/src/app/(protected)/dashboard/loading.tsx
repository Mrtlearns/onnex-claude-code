// apps/web/src/app/(protected)/dashboard/loading.tsx
// Skeleton layout shown while dashboard Server Component loads

import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI card skeletons — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Activity feed + sidebar skeletons */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Activity list skeleton */}
        <div className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-6 w-32" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions + team workload skeletons */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-6 w-28" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-6 w-32" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
