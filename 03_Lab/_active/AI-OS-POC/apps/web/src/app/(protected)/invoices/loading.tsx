// apps/web/src/app/(protected)/invoices/loading.tsx
// Skeleton layout shown while invoices page Server Component loads

import { Skeleton } from "@/components/ui/skeleton"

export default function InvoicesLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
