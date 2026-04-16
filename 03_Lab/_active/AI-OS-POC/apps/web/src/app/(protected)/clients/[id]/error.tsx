"use client"
// apps/web/src/app/(protected)/clients/[id]/error.tsx

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ClientDetailError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Failed to load client</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  )
}
