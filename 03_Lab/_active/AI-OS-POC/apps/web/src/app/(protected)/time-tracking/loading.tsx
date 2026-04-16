// apps/web/src/app/(protected)/time-tracking/loading.tsx
// Skeleton for time tracking page

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function TimeTrackingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
      {/* Timer widget skeleton */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
      {/* Week nav skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-20" />
      </div>
      {/* 7-day grid skeleton */}
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-1 pt-2 px-2">
              <Skeleton className="h-3 w-full" />
            </CardHeader>
            <CardContent className="pb-2 px-2">
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Entry list skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
