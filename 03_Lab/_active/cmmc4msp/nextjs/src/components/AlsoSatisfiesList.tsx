'use client'
import { useEffect, useState, useCallback } from 'react'
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useSession } from 'next-auth/react'

const API = process.env.NEXT_PUBLIC_API_URL || ''

interface Suggestion {
  control_definition_id: string
  nist_id: string
  cmmc_id: string
  requirement_text: string
  family: string
  family_abbrev: string
  similarity_score: number
  supporting_chunks: string[]
}

interface SuggestionsResponse {
  artifact_id: string
  suggestions: Suggestion[]
  note?: string
  cached?: boolean
}

interface AlsoSatisfiesListProps {
  artifactId: string
  orgSlug: string
  programId: string
  onApply?: (controlDefinitionId: string) => void
}

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.9 ? 'bg-green-500' : score >= 0.8 ? 'bg-blue-500' : 'bg-amber-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

export function AlsoSatisfiesList({ artifactId, orgSlug, programId, onApply }: AlsoSatisfiesListProps) {
  const { data: session } = useSession()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState<Record<string, boolean>>({})
  const [applied, setApplied] = useState<Record<string, boolean>>({})

  const fetchSuggestions = useCallback(async () => {
    if (!session) return
    const token = (session.user as any)?.accessToken
    if (!token) return

    setState('loading')
    try {
      const r = await fetch(`${API}/api/artifacts/${artifactId}/suggest-controls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error('Failed to fetch suggestions')
      const data: SuggestionsResponse = await r.json()
      setSuggestions(data.suggestions || [])
      setNote(data.note || '')
      setState('done')
    } catch {
      setState('error')
    }
  }, [artifactId, session])

  useEffect(() => {
    // Auto-fetch after a short delay to let upload settle
    const t = setTimeout(fetchSuggestions, 2000)
    return () => clearTimeout(t)
  }, [fetchSuggestions])

  if (state === 'idle' || state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <SparklesIcon className="w-3.5 h-3.5 animate-pulse text-purple-400" />
        {state === 'loading' ? 'Finding similar controls…' : 'Checking for cross-control coverage…'}
      </div>
    )
  }

  if (state === 'error') return null

  if (suggestions.length === 0) {
    return note ? (
      <p className="text-xs text-gray-400 py-2">{note}</p>
    ) : (
      <p className="text-xs text-gray-400 py-2">No similar controls found above threshold.</p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SparklesIcon className="w-4 h-4 text-purple-500" />
        <p className="text-xs font-semibold text-purple-800">
          This artifact may also satisfy {suggestions.length} other control{suggestions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {suggestions.map((s) => (
        <div key={s.control_definition_id} className="border border-purple-100 bg-purple-50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-mono text-xs font-bold text-purple-800">{s.nist_id}</span>
                <span className="text-xs text-purple-400">·</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                  {s.family_abbrev}
                </span>
              </div>
              <p className="text-xs text-gray-700 line-clamp-2">{s.requirement_text}</p>
            </div>
            {applied[s.control_definition_id] ? (
              <span className="text-xs text-green-600 font-medium flex-shrink-0">Applied ✓</span>
            ) : (
              <button
                onClick={async () => {
                  setApplying((a) => ({ ...a, [s.control_definition_id]: true }))
                  if (onApply) await onApply(s.control_definition_id)
                  setApplied((a) => ({ ...a, [s.control_definition_id]: true }))
                  setApplying((a) => ({ ...a, [s.control_definition_id]: false }))
                }}
                disabled={applying[s.control_definition_id]}
                className="text-xs text-purple-700 border border-purple-300 px-2 py-0.5 rounded hover:bg-purple-100 transition-colors flex-shrink-0 disabled:opacity-50"
              >
                {applying[s.control_definition_id] ? '…' : 'Apply'}
              </button>
            )}
          </div>

          <SimilarityBar score={s.similarity_score} />

          {s.supporting_chunks.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((e) => ({ ...e, [s.control_definition_id]: !e[s.control_definition_id] }))}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
              >
                {expanded[s.control_definition_id] ? (
                  <ChevronUpIcon className="w-3 h-3" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3" />
                )}
                {expanded[s.control_definition_id] ? 'Hide' : 'Show'} matching excerpt
              </button>
              {expanded[s.control_definition_id] && (
                <blockquote className="mt-1.5 border-l-2 border-purple-300 pl-2 text-xs text-gray-600 italic">
                  "{s.supporting_chunks[0]}"
                </blockquote>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
