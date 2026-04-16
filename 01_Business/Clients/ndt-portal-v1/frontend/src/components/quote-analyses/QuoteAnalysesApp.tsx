/**
 * QuoteAnalysesApp — Central viewer for all LLM analysis responses
 *
 * Global list from app.diagram_analyses, filterable by:
 *   - Inspection type (RT/UT/ET/MT/PT/VT)
 *   - Quote number (free text)
 *   - Quote type (email/ut/rt)
 *
 * Row click → full JSON viewer drawer
 *
 * API: GET /diagram-analyses?inspectionType=&quoteNumber=&quoteType=&limit=
 */

import { useCallback, useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api'
import { BarChart2, RefreshCw, AlertCircle, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiagramAnalysis {
  id:            string
  email_quote_id: string | null
  ut_quote_id:   string | null
  rt_quote_id:   string | null
  quote_type:    'email' | 'ut' | 'rt'
  quote_number:  string | null
  inspection_type: string
  step_name:     string
  raw_response:  Record<string, unknown>
  created_at:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  RT: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  UT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  ET: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  MT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  PT: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  VT: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

const SOURCE_COLORS: Record<string, string> = {
  email: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ut:    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  rt:    'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
}

const NDT_TYPES = ['RT', 'UT', 'ET', 'MT', 'PT', 'VT']
const QUOTE_TYPES = ['email', 'ut', 'rt']

// ── JSON Drawer ───────────────────────────────────────────────────────────────

function JsonDrawer({ analysis, onClose }: { analysis: DiagramAnalysis; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background border-l border-border flex flex-col h-full shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-sm">{analysis.step_name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {analysis.quote_number ?? analysis.id} · {analysis.inspection_type} · {analysis.quote_type}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-lg p-3 leading-relaxed">
            {JSON.stringify(analysis.raw_response, null, 2)}
          </pre>
        </div>
        <div className="px-4 py-3 border-t border-border shrink-0 text-xs text-muted-foreground">
          Created: {new Date(analysis.created_at).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function QuoteAnalysesApp() {
  const [analyses, setAnalyses] = useState<DiagramAnalysis[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<DiagramAnalysis | null>(null)

  // Filters
  const [filterType,   setFilterType]   = useState('')
  const [filterNumber, setFilterNumber] = useState('')
  const [filterSource, setFilterSource] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (filterType)   params.set('inspectionType', filterType)
      if (filterNumber) params.set('quoteNumber', filterNumber)
      if (filterSource) params.set('quoteType', filterSource)
      const r = await fetch(`/api/diagram-analyses?${params}`, { headers: getAuthHeaders() })
      if (!r.ok) throw new Error('Failed to load analyses')
      setAnalyses(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [filterType, filterNumber, filterSource])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart2 className="h-6 w-6" /> Quote Analyses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All LLM analysis responses across email, UT, and RT quotes.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {NDT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All sources</option>
          {QUOTE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <input
          type="text"
          placeholder="Quote number…"
          value={filterNumber}
          onChange={e => setFilterNumber(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm w-44"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Quote</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Source</th>
              <th className="text-left px-4 py-2.5">Step</th>
              <th className="text-left px-4 py-2.5">Created</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && analyses.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                  No analyses found.
                </td>
              </tr>
            )}
            {analyses.map((a, i) => (
              <tr
                key={a.id}
                onClick={() => setSelected(a)}
                className={cn(
                  'cursor-pointer border-t border-border transition-colors hover:bg-muted/50',
                  i % 2 === 0 ? '' : 'bg-muted/20',
                )}
              >
                <td className="px-4 py-2.5 font-mono text-xs">{a.quote_number ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', TYPE_COLORS[a.inspection_type] ?? '')}>
                    {a.inspection_type}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', SOURCE_COLORS[a.quote_type] ?? '')}>
                    {a.quote_type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">{a.step_name}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selected && <JsonDrawer analysis={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
