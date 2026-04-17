"use client"
// apps/web/src/app/(protected)/admin/error.tsx
// Error boundary for Admin module

import { Button } from "@/components/ui/button"

interface ErrorProps {
  error: Error
  reset: () => void
}

export default function AdminError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12">
      <h2 className="text-lg font-semibold text-destructive">Failed to load Admin panel</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  )
}
