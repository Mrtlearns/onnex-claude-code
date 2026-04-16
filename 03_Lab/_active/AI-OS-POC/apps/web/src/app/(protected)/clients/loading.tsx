// apps/web/src/app/(protected)/clients/loading.tsx
// Skeleton layout shown while clients page Server Component loads

import { Skeleton } from "@/components/ui/skeleton"

export default function ClientsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-20" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
