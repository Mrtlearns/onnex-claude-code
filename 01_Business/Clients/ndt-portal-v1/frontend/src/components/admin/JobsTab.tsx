import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { RefreshCw, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────
interface JobRun {
  id: number
  job_name: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  status: 'running' | 'success' | 'error'
  records_upserted: Record<string, number> | null
  summary: string | null
  error: string | null
}

interface JobsResponse {
  total: number
  runs: JobRun[]
}

// ── Helpers ────────────────────────────────────────────────────
function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  return `${m}m ${rem}s`
}

function formatDatetime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function compactCounts(rec: Record<string, number> | null): string {
  if (!rec) return '—'
  return Object.entries(rec)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
}

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
    status === 'error'   ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  return (
    <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded', cls)}>
      {status}
    </span>
  )
}

// ── Row expand ─────────────────────────────────────────────────
function JobRow({ run }: { run: JobRun }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/40 cursor-pointer transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-3 py-2.5 w-6">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{run.id}</td>
        <td className="px-3 py-2.5">
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{run.job_name}</span>
        </td>
        <td className="px-3 py-2.5"><StatusBadge status={run.status} /></td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {formatDatetime(run.started_at)}
        </td>
        <td className="px-3 py-2.5 text-xs text-right tabular-nums">
          {formatDuration(run.duration_ms)}
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
          {compactCounts(run.records_upserted)}
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[280px] truncate">
          {run.summary ?? '—'}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={8} className="px-6 py-3">
            <div className="space-y-2 text-xs">
              {run.summary && (
                <div>
                  <span className="font-semibold text-foreground">Summary: </span>
                  <span className="text-muted-foreground">{run.summary}</span>
                </div>
              )}
              {run.records_upserted && (
                <div>
                  <span className="font-semibold text-foreground">Records: </span>
                  <span className="font-mono text-muted-foreground">
                    {JSON.stringify(run.records_upserted, null, 2)}
                  </span>
                </div>
              )}
              {run.error && (
                <div>
                  <span className="font-semibold text-red-600">Error:</span>
                  <pre className="mt-1 text-[11px] bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 rounded p-2 overflow-x-auto whitespace-pre-wrap text-red-800 dark:text-red-400">
                    {run.error}
                  </pre>
                </div>
              )}
              <div className="text-muted-foreground/60">
                Started: {run.started_at}
                {run.finished_at && ` · Finished: ${run.finished_at}`}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────
const PAGE_SIZE = 50

export default function JobsTab() {
  const { accessToken } = useAuth()
  const [data, setData]       = useState<JobsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [offset, setOffset]   = useState(0)

  const load = useCallback(async (off: number) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/ut/admin/jobs?limit=${PAGE_SIZE}&offset=${off}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json: JobsResponse = await r.json()
      setData(json)
      setOffset(off)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + 30s auto-refresh
  useEffect(() => {
    if (!accessToken) return
    load(0)
    const interval = setInterval(() => load(offset), 30_000)
    return () => clearInterval(interval)
  }, [load, offset, accessToken])

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Job Run History</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {data ? `${data.total} total runs` : 'Loading…'} · auto-refreshes every 30s
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={() => load(offset)}
            disabled={loading}
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <div className="px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {!error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 w-6" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Job</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Started</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Duration</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Records</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Summary</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                )}
                {data?.runs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No job runs yet. Trigger a sync to see history.
                    </td>
                  </tr>
                )}
                {data?.runs.map(run => (
                  <JobRow key={run.id} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>Page {currentPage} of {totalPages} ({data.total} total)</span>
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline" className="h-6 text-xs px-2"
                onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0 || loading}
              >
                Previous
              </Button>
              <Button
                size="sm" variant="outline" className="h-6 text-xs px-2"
                onClick={() => load(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= data.total || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
