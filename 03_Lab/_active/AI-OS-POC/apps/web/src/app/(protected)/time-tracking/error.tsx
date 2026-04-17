"use client"
// apps/web/src/app/(protected)/time-tracking/error.tsx
// Error boundary for time tracking page

import { Button } from "@/components/ui/button"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function TimeTrackingError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <p className="text-lg font-medium text-destructive">
        Failed to load time tracking
      </p>
      <p className="text-sm text-muted-foreground max-w-sm">{error.message}</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
