"use client"

// ─────────────────────────────────────────────────────────────────────────────
// MetricsPanel — cognitive architecture KPI cards
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainMetrics } from "./types"

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

interface MetricsPanelProps {
  metrics: BrainMetrics | null
  loading?: boolean
  className?: string
}

export function MetricsPanel({ metrics, loading, className }: MetricsPanelProps) {
  if (loading || !metrics) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className ?? ""}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 animate-pulse h-16" />
        ))}
      </div>
    )
  }

  const completedJobs = metrics.recentJobs.filter((j) => j.status === "completed").length
  const runningJobs   = metrics.recentJobs.filter((j) => j.status === "running").length
  const failedJobs    = metrics.recentJobs.filter((j) => j.status === "failed").length

  const typeCount = Object.keys(metrics.entityTypes).length

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className ?? ""}`}>
      <StatCard
        label="Entities"
        value={metrics.totalEntities}
        sub={`${typeCount} type${typeCount !== 1 ? "s" : ""}`}
      />
      <StatCard
        label="Relationships"
        value={metrics.totalLinks}
        sub="knowledge edges"
      />
      <StatCard
        label="Job Runs"
        value={metrics.recentJobs.length}
        sub={runningJobs > 0 ? `${runningJobs} running` : `${completedJobs} completed · ${failedJobs} failed`}
        accent={runningJobs > 0 ? "text-blue-400" : undefined}
      />
      <StatCard
        label="Embed Model"
        value={metrics.embedStatus?.dimensions ?? "—"}
        sub={metrics.embedStatus?.model ?? "unknown"}
        accent={metrics.embedStatus?.status === "ok" ? "text-emerald-500" : "text-red-400"}
      />
    </div>
  )
}
