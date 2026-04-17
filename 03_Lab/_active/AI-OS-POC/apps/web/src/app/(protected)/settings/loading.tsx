// apps/web/src/app/(protected)/settings/loading.tsx
// Skeleton loader for Settings page

import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-64 w-full max-w-2xl" />
    </div>
  )
}
