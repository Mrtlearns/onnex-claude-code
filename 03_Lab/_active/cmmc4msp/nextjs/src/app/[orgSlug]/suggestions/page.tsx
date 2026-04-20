'use client'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_ORG_BY_SLUG } from '@/graphql/queries'
import {
  SparklesIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface SuggestionsPageProps {
  params: { orgSlug: string }
}

interface SweepAction {
  id: string
  nist_id: string
  recommended_action: string
  gap_summary: string
  confidence: number
  applied: boolean
  program_control_id: string
}

export default function SuggestionsPage({ params }: SuggestionsPageProps) {
  const { orgSlug } = params
  const [loading, setLoading] = useState(false)
  const [actions, setActions] = useState<SweepAction[]>([])
  const [sweepReport, setSweepReport] = useState<{ summary?: string; themes?: string[] } | null>(null)
  const [sweepId, setSweepId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [applied, setApplied] = useState<Set<string>>(new Set())

  const { data: orgData } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const org = orgData?.orgs?.[0]
  const programId = org?.programs?.[0]?.id

  const runSweep = async () => {
    if (!programId) return
    setLoading(true)
    setError(null)
    setActions([])
    setSweepReport(null)
    setSweepId(null)

    try {
      const { getSession } = await import('next-auth/react')
      const session = await getSession() as any
      const token = session?.user?.accessToken || ''

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/programs/${programId}/ai-sweep`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.detail || res.statusText)
      }

      const sweep = await res.json()
      const sid = sweep.sweep_id
      setSweepId(sid)

      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const poll = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/programs/${programId}/ai-sweep/${sid}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )
        if (!poll.ok) break
        const result = await poll.json()
        if (result.status === 'ready') {
          setActions(result.actions || [])
          if (result.sweep_report) {
            const report = typeof result.sweep_report === 'string'
              ? JSON.parse(result.sweep_report)
              : result.sweep_report
            setSweepReport(report)
          }
          break
        }
        if (result.status === 'failed') {
          throw new Error(result.error_message || 'Sweep failed')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Sweep failed')
    } finally {
      setLoading(false)
    }
  }

  const applyAction = async (action: SweepAction) => {
    if (!programId || !sweepId) return
    try {
      const { getSession } = await import('next-auth/react')
      const session = await getSession() as any
      const token = session?.user?.accessToken || ''

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/programs/${programId}/ai-sweep/${sweepId}/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action_ids: [action.id] }),
        }
      )

      if (res.ok) {
        setApplied((prev) => new Set([...prev, action.id]))
      }
    } catch {
      // silent
    }
  }

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return 'text-emerald-700 bg-emerald-50'
    if (c >= 0.6) return 'text-amber-700 bg-amber-50'
    return 'text-slate-600 bg-slate-50'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-violet-500" />
            AI Sweep
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Claude analyzes all open controls and ranks the highest-impact actions for {org?.name || 'this org'}
          </p>
        </div>
        <button
          onClick={runSweep}
          disabled={loading || !programId}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <SparklesIcon className="w-4 h-4" />
              Run AI Sweep
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {sweepReport && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg p-4 space-y-2">
          {sweepReport.summary && (
            <p className="text-sm text-violet-900">{sweepReport.summary}</p>
          )}
          {sweepReport.themes && sweepReport.themes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {sweepReport.themes.map((t, i) => (
                <span key={i} className="text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && actions.length === 0 && !error && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          <SparklesIcon className="w-8 h-8 mx-auto mb-3 text-violet-400" />
          <p className="font-medium text-slate-700 mb-1">No sweep results yet</p>
          <p className="text-sm">
            Click &ldquo;Run AI Sweep&rdquo; to let Claude analyze your open controls and generate a
            prioritized action plan. Takes 30–90 seconds.
          </p>
        </div>
      )}

      {actions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {actions.length} prioritized action{actions.length !== 1 ? 's' : ''} identified
          </p>
          {actions.map((action, idx) => {
            const key = action.id
            const isExpanded = expanded === key
            const isApplied = applied.has(key) || action.applied

            return (
              <div
                key={key}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${confidenceColor(action.confidence)}`}
                    >
                      {Math.round(action.confidence * 100)}%
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {action.nist_id} — {action.recommended_action}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {isApplied ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircleIcon className="w-3 h-3" />
                        Applied
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          applyAction(action)
                        }}
                        className="text-xs text-violet-700 bg-violet-50 px-2 py-1 rounded hover:bg-violet-100 transition-colors"
                      >
                        Apply
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Gap Analysis
                    </p>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded p-2 leading-relaxed">
                      {action.gap_summary}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-violet-50 border border-violet-100 rounded-lg p-4 text-sm text-violet-800">
        <strong>How it works:</strong> The AI Sweep sends all open controls to Claude, which analyzes
        gaps and ranks the highest-impact actions. Click &ldquo;Apply&rdquo; to update the
        control&apos;s status based on the recommendation.
      </div>
    </div>
  )
}
