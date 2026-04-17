'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ChartBarIcon, BuildingOfficeIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'

interface OrgSummary {
  id: string
  name: string
  slug: string
  program_count: number
  latest_sprs: number | null
  last_activity_at: string | null
}

interface AnalyticsSummary {
  orgs: OrgSummary[]
  org_count: number
  top_failing_controls: { nist_id: string; requirement_text: string; fail_count: number }[]
  weekly_activity: { assessed_this_week: number; met_this_week: number }
  sprs_distribution: { negative: number; zero_to_50: number; fifty_to_100: number; perfect: number }
}

function sprsColor(score: number | null): string {
  if (score === null) return 'text-gray-400'
  if (score < 0) return 'text-red-600'
  if (score >= 100) return 'text-green-600'
  return 'text-amber-600'
}

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = (session?.user as any)?.accessToken
    if (!token) return
    fetch('/api/analytics/msp-summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [session])

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading analytics...</div>
  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>
  if (!data) return null

  const sprs = data.sprs_distribution

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <ChartBarIcon className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">MSP Portfolio Analytics</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Client Orgs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.org_count}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Assessed This Week</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{data.weekly_activity.assessed_this_week}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Met This Week</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{data.weekly_activity.met_this_week}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Negative SPRS</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{sprs.negative}</p>
        </div>
      </div>

      {/* SPRS Distribution */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">SPRS Score Distribution</h2>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="rounded bg-red-50 p-3">
            <p className="text-lg font-bold text-red-600">{sprs.negative}</p>
            <p className="text-xs text-gray-500 mt-1">Negative</p>
          </div>
          <div className="rounded bg-amber-50 p-3">
            <p className="text-lg font-bold text-amber-600">{sprs.zero_to_50}</p>
            <p className="text-xs text-gray-500 mt-1">0 - 49</p>
          </div>
          <div className="rounded bg-yellow-50 p-3">
            <p className="text-lg font-bold text-yellow-600">{sprs.fifty_to_100}</p>
            <p className="text-xs text-gray-500 mt-1">50 - 109</p>
          </div>
          <div className="rounded bg-green-50 p-3">
            <p className="text-lg font-bold text-green-600">{sprs.perfect}</p>
            <p className="text-xs text-gray-500 mt-1">110 (Perfect)</p>
          </div>
        </div>
      </div>

      {/* Top failing controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldExclamationIcon className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-700">Top Failing Controls (Portfolio)</h2>
        </div>
        {data.top_failing_controls.length === 0 ? (
          <p className="text-sm text-gray-400">No failing controls recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Control</th>
                <th className="text-left pb-2 font-medium">Requirement</th>
                <th className="text-right pb-2 font-medium">Client Failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.top_failing_controls.map((c) => (
                <tr key={c.nist_id}>
                  <td className="py-2 font-mono text-blue-700 font-semibold pr-4 whitespace-nowrap">{c.nist_id}</td>
                  <td className="py-2 text-gray-600 pr-4">{c.requirement_text}</td>
                  <td className="py-2 text-right font-semibold text-red-600">{c.fail_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Client org table */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Client Organizations</h2>
        </div>
        {data.orgs.length === 0 ? (
          <p className="text-sm text-gray-400">No client organizations onboarded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Organization</th>
                <th className="text-right pb-2 font-medium">Programs</th>
                <th className="text-right pb-2 font-medium">SPRS Score</th>
                <th className="text-right pb-2 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.orgs.map((org) => (
                <tr key={org.id}>
                  <td className="py-2 font-medium text-gray-800">{org.name}</td>
                  <td className="py-2 text-right text-gray-500">{org.program_count}</td>
                  <td className={`py-2 text-right font-bold ${sprsColor(org.latest_sprs)}`}>
                    {org.latest_sprs !== null ? org.latest_sprs : '—'}
                  </td>
                  <td className="py-2 text-right text-gray-400 text-xs">
                    {org.last_activity_at ? new Date(org.last_activity_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
