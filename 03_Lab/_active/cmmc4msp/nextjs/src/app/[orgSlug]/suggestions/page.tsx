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

interface Suggestion {
  control_definition_id: string
  nist_id: string
  title: string
  similarity_score: number
  chunk_excerpts: string[]
  artifact_name: string
  artifact_id: string
}

export default function SuggestionsPage({ params }: SuggestionsPageProps) {
  const { orgSlug } = params
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
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
    setSuggestions([])

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

      // Poll for completion
      const sweepId = sweep.sweep_id
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const poll = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/programs/${programId}/ai-sweep/${sweepId}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        )
        if (!poll.ok) break
        const result = await poll.json()
        if (result.status === 'complete') {
          setSuggestions(result.suggestions || [])
          break
        }
        if (result.status === 'failed') {
          throw new Error(result.error || 'Sweep failed')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Sweep failed')
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = async (s: Suggestion) => {
    if (!programId) return
    try {
      const { getSession } = await import('next-auth/react')
      const session = await getSession() as any
      const token = session?.user?.accessToken || ''

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${s.artifact_id}/apply-to-control`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ control_definition_id: s.control_definition_id }),
        }
      )

      if (res.ok) {
        setApplied((prev) => new Set([...prev, s.control_definition_id]))
      }
    } catch {
      // silent — main action completed
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-700 bg-emerald-50'
    if (score >= 0.65) return 'text-amber-700 bg-amber-50'
    return 'text-slate-600 bg-slate-50'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-violet-500" />
            AI Suggestions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Scan uploaded artifacts for controls they could satisfy across {org?.name || 'this org'}
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
              Scanning…
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

      {!loading && suggestions.length === 0 && !error && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          <SparklesIcon className="w-8 h-8 mx-auto mb-3 text-violet-400" />
          <p className="font-medium text-slate-700 mb-1">No suggestions yet</p>
          <p className="text-sm">
            Click &ldquo;Run AI Sweep&rdquo; to analyze uploaded artifacts and find controls they could
            help satisfy. Results use semantic similarity — higher scores mean stronger matches.
          </p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} found
          </p>
          {suggestions.map((s) => {
            const key = s.control_definition_id
            const isExpanded = expanded === key
            const isApplied = applied.has(key)

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
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${scoreColor(s.similarity_score)}`}
                    >
                      {Math.round(s.similarity_score * 100)}%
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {s.nist_id} — {s.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">from: {s.artifact_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {isApplied && (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircleIcon className="w-3 h-3" />
                        Applied
                      </span>
                    )}
                    {!isApplied && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          applySuggestion(s)
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

                {isExpanded && s.chunk_excerpts?.length > 0 && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Relevant excerpts
                    </p>
                    {s.chunk_excerpts.slice(0, 3).map((excerpt, i) => (
                      <p
                        key={i}
                        className="text-xs text-gray-700 bg-gray-50 rounded p-2 leading-relaxed"
                      >
                        &ldquo;{excerpt}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-violet-50 border border-violet-100 rounded-lg p-4 text-sm text-violet-800">
        <strong>How it works:</strong> The AI Sweep compares each artifact&apos;s extracted text
        against all control requirements using semantic embeddings. Matches above 50% similarity are
        surfaced here. Click &ldquo;Apply&rdquo; to link the artifact as evidence for that control.
      </div>
    </div>
  )
}
