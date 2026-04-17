// apps/web/src/app/(portal)/invoices/loading.tsx
// Skeleton placeholder while invoices data loads

import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}
