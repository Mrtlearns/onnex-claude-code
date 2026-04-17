// apps/web/src/app/(protected)/reports/loading.tsx
// Skeleton layout shown while reports page Server Component loads

import { Skeleton } from "@/components/ui/skeleton"

export default function ReportsLoading() {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Tab triggers */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Chart area */}
      <Skeleton className="h-72 w-full" />

      {/* Table rows */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
