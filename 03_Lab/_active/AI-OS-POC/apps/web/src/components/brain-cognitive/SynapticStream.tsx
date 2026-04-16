"use client"

// ─────────────────────────────────────────────────────────────────────────────
// SynapticStream — live feed of recent BRAIN job runs
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainJobRun } from "./types"

const STATUS_STYLES: Record<string, string> = {
  completed: "text-emerald-500",
  running:   "text-blue-400",
  failed:    "text-red-400",
}

const STATUS_DOTS: Record<string, string> = {
  completed: "bg-emerald-500",
  running:   "bg-blue-400 animate-pulse",
  failed:    "bg-red-400",
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diffMs / 1000)
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface SynapticStreamProps {
  jobs: BrainJobRun[]
  loading?: boolean
  className?: string
}

export function SynapticStream({ jobs, loading, className }: SynapticStreamProps) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full text-muted-foreground text-sm ${className ?? ""}`}>
        Loading stream…
      </div>
    )
  }

  if (!jobs.length) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 ${className ?? ""}`}>
        <span className="text-2xl opacity-30">∿</span>
        <p>No activity yet</p>
      </div>
    )
  }

  return (
    <ul className={`space-y-2 overflow-y-auto pr-1 ${className ?? ""}`}>
      {jobs.map((job) => (
        <li key={job.id} className="flex items-start gap-2.5 text-xs">
          <span
            className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_DOTS[job.status] ?? "bg-muted"}`}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{job.sop_title}</p>
            <p className="text-muted-foreground">
              <span className={STATUS_STYLES[job.status]}>{job.status}</span>
              {" · "}
              {formatRelative(job.started_at)}
              {job.completed_at && job.status === "completed" && (
                <>
                  {" · "}
                  {Math.round(
                    (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000,
                  )}s
                </>
              )}
            </p>
            {job.error && (
              <p className="text-red-400 truncate mt-0.5">{job.error}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
