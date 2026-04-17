// apps/web/src/app/(protected)/documents/loading.tsx
// Skeleton layout: two-panel (sidebar list + main viewer) shown while Server Component loads

import { Skeleton } from "@/components/ui/skeleton"

export default function DocumentsLoading() {
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      {/* Two-panel grid skeleton */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-4 flex-1">
        {/* Left sidebar — document list */}
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        {/* Right panel — document viewer */}
        <Skeleton className="h-[70vh] w-full rounded" />
      </div>
    </div>
  )
}
