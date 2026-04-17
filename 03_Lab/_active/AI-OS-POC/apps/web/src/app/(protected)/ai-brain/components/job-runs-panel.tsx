"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export interface BrainJobRun {
  id: string
  sop_slug: string
  sop_title: string
  status: "running" | "completed" | "failed"
  input: Record<string, unknown> | null
  output: string | null
  error: string | null
  started_at: string
  completed_at: string | null
}

interface JobRunsPanelProps {
  jobs: BrainJobRun[]
  isLoading: boolean
  onRefresh: () => void
}

function StatusBadge({ status }: { status: BrainJobRun["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30">
        <Loader2 className="h-3 w-3 animate-spin" />
        running
      </span>
    )
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/15 text-green-400 ring-1 ring-green-500/30">
        <CheckCircle2 className="h-3 w-3" />
        completed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/15 text-red-400 ring-1 ring-red-500/30">
      <XCircle className="h-3 w-3" />
      failed
    </span>
  )
}

function JobRunRow({ job }: { job: BrainJobRun }) {
  const [expanded, setExpanded] = useState(false)

  const preview = job.output
    ? job.output.slice(0, 120) + (job.output.length > 120 ? "…" : "")
    : job.error
      ? job.error.slice(0, 120) + (job.error.length > 120 ? "…" : "")
      : null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusBadge status={job.status} />
          <span className="text-sm font-medium text-foreground truncate">{job.sop_title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {relativeTime(job.started_at)}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {!expanded && preview && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground font-mono leading-relaxed">{preview}</p>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 border-t border-border pt-2">
          {job.output && (
            <pre className="whitespace-pre-wrap text-xs text-foreground font-mono leading-relaxed max-h-96 overflow-y-auto">{job.output}</pre>
          )}
          {job.error && (
            <pre className="whitespace-pre-wrap text-xs text-red-400 font-mono leading-relaxed">{job.error}</pre>
          )}
          {!job.output && !job.error && (
            <p className="text-xs text-muted-foreground italic">No output yet…</p>
          )}
        </div>
      )}
    </div>
  )
}

export function JobRunsPanel({ jobs, isLoading, onRefresh }: JobRunsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Job Runs</h2>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {jobs.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No job runs yet. Run a SOP to get started.</p>
        </div>
      )}

      {isLoading && jobs.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {jobs.map((job) => (
          <JobRunRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  )
}
