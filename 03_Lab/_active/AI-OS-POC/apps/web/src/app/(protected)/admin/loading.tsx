// apps/web/src/app/(protected)/admin/loading.tsx
// Skeleton loading state for Admin module

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="flex gap-4">
        <div className="h-10 w-32 rounded bg-muted" />
        <div className="h-10 w-32 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}
