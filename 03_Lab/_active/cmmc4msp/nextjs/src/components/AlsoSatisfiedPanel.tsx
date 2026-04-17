'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { useSession } from 'next-auth/react'

const API = process.env.NEXT_PUBLIC_API_URL || ''

interface ReuseSummary {
  program_id: string
  artifact_count: number
  control_count: number
}

interface AlsoSatisfiedPanelProps {
  programId: string
  orgSlug: string
}

export function AlsoSatisfiedPanel({ programId, orgSlug }: AlsoSatisfiedPanelProps) {
  const { data: session } = useSession()
  const [summary, setSummary] = useState<ReuseSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    const token = (session.user as any)?.accessToken
    if (!token) return

    fetch(`${API}/api/programs/${programId}/reuse-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setSummary(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [programId, session])

  if (loading || !summary || summary.control_count === 0) return null

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="bg-purple-100 rounded-lg p-1.5 mt-0.5 flex-shrink-0">
          <SparklesIcon className="w-4 h-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-purple-900">
            AI Evidence Reuse Detected
          </p>
          <p className="text-xs text-purple-700 mt-0.5">
            <span className="font-bold">{summary.artifact_count}</span> uploaded artifact
            {summary.artifact_count !== 1 ? 's' : ''} could satisfy{' '}
            <span className="font-bold">{summary.control_count}</span> additional control
            {summary.control_count !== 1 ? 's' : ''} you haven't linked yet.
          </p>
        </div>
        <Link
          href={`/${orgSlug}/controls?tab=suggestions`}
          className="flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-900 flex-shrink-0"
        >
          Review
          <ArrowRightIcon className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
