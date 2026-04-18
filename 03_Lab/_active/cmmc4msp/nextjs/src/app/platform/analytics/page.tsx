'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import { GET_ADMIN_ORGS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'

export default function PlatformAnalytics() {
  const { data: session } = useSession()
  const { data, loading } = useQuery(GET_ADMIN_ORGS, { skip: !session })
  const orgs = data?.orgs ?? []

  const scores = orgs
    .map((o: any) => o.programs?.[0]?.sprs_score ?? 0)
    .filter((s: number) => s !== 0)

  const avg = scores.length
    ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
    : 0

  const buckets = [
    { label: '−203 to −100', min: -203, max: -100, color: 'bg-red-500' },
    { label: '−99 to −50',  min: -99,  max: -50,  color: 'bg-orange-400' },
    { label: '−49 to 0',   min: -49,  max: 0,    color: 'bg-amber-400' },
    { label: '1 to 54',    min: 1,    max: 54,   color: 'bg-lime-500' },
    { label: '55 to 110',  min: 55,   max: 110,  color: 'bg-emerald-500' },
  ]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-56" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-40 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">SPRS score distribution across all clients</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Total Orgs</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{orgs.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg SPRS</p>
          <p className={`text-3xl font-bold mt-1 ${getSPRSColor(avg)}`}>{avg || '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Orgs Tracked</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{scores.length}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-800 mb-4">SPRS Score Distribution</h2>
        <div className="space-y-3">
          {buckets.map((b) => {
            const count = scores.filter((s: number) => s >= b.min && s <= b.max).length
            const pct = scores.length ? Math.round((count / scores.length) * 100) : 0
            return (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">{b.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all duration-500 ${b.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-12 text-right">{count} org{count !== 1 ? 's' : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
