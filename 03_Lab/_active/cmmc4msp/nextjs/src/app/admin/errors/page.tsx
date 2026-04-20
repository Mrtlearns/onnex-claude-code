'use client'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import { GET_RECENT_ERRORS, GET_LATEST_TRIAGE_REPORT } from '@/graphql/queries'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface ErrorEvent {
  id: string
  source: string
  component: string
  severity: string
  message: string
  created_at: string
  correlation_id: string | null
  org_id: string | null
}

interface TriageReport {
  id: string
  status: string
  event_count: number | null
  report: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    error: 'bg-orange-100 text-orange-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[severity] ?? 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  )
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

export default function ErrorsDashboardPage() {
  const { data: session } = useSession()
  const user = session?.user as { role?: string; accessToken?: string } | undefined

  const [triageRunning, setTriageRunning] = useState(false)
  const [triageError, setTriageError] = useState<string | null>(null)

  const {
    data: errorsData,
    loading: errorsLoading,
    error: errorsQueryError,
    refetch: refetchErrors,
  } = useQuery(GET_RECENT_ERRORS, {
    variables: { limit: 50 },
    fetchPolicy: 'cache-and-network',
  })

  const {
    data: triageData,
    loading: triageLoading,
    refetch: refetchTriage,
  } = useQuery(GET_LATEST_TRIAGE_REPORT, {
    fetchPolicy: 'cache-and-network',
  })

  if (user?.role !== 'msp_admin' && user?.role !== 'super_admin') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 text-center text-gray-500">
        Access denied. MSP admin or super admin role required.
      </div>
    )
  }

  const events: ErrorEvent[] = errorsData?.error_events ?? []
  const triageReport: TriageReport | null = triageData?.triage_reports?.[0] ?? null

  async function runTriage() {
    setTriageRunning(true)
    setTriageError(null)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://api.cmmc4msp.on-nex.us'}/api/triage/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
          },
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `HTTP ${res.status}`)
      }
      // Refresh both queries after triggering triage
      await Promise.all([refetchErrors(), refetchTriage()])
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Triage failed')
    } finally {
      setTriageRunning(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
            Error Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Untriaged client and server errors — {events.length} shown
          </p>
        </div>
        <button
          onClick={runTriage}
          disabled={triageRunning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowPathIcon className={`w-4 h-4 ${triageRunning ? 'animate-spin' : ''}`} />
          {triageRunning ? 'Running triage…' : 'Run new triage'}
        </button>
      </div>

      {triageError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Triage error: {triageError}
        </div>
      )}

      {/* Triage status card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Latest Triage Report</h2>
        {triageLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : triageReport ? (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  triageReport.status === 'complete'
                    ? 'bg-green-100 text-green-700'
                    : triageReport.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {triageReport.status}
              </span>
              <span className="text-sm text-gray-600">
                {triageReport.event_count != null ? `${triageReport.event_count} events processed` : ''}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(triageReport.created_at).toLocaleString()}
              </span>
            </div>
            {triageReport.report && (
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                {truncate(triageReport.report, 500)}
              </p>
            )}
            {triageReport.error_message && (
              <p className="text-sm text-red-600 mt-1">{triageReport.error_message}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No triage report yet.</p>
        )}
      </div>

      {/* Error events table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Severity</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Component</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Message</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Correlation ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {errorsLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : errorsQueryError ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-red-500">
                  Failed to load errors: {errorsQueryError.message}
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No untriaged errors.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <SeverityBadge severity={ev.severity} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[180px] truncate">
                    {ev.component}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[320px]">
                    {truncate(ev.message, 120)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[140px] truncate">
                    {ev.correlation_id ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
