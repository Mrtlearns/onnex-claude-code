'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import { GET_ORGS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'

export default function MspAnalytics() {
  const { data: session } = useSession()
  const { data, loading } = useQuery(GET_ORGS, { skip: !session })
  const orgs = data?.orgs ?? []

  const scores = orgs.map((o: any) => o.programs?.[0]?.sprs_score ?? 0)
  const avg = scores.length
    ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
    : 0

  const byPhase = [1, 2, 3, 4, 5].map((phase) => ({
    phase,
    count: orgs.filter((o: any) => o.programs?.[0]?.current_phase === phase).length,
  }))

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">MSP Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Portfolio-level compliance metrics</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Client Orgs</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{orgs.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Portfolio Avg SPRS</p>
          <p className={`text-3xl font-bold mt-1 ${getSPRSColor(avg)}`}>{avg || '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Certified</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">
            {orgs.filter((o: any) => o.programs?.[0]?.status === 'certified').length}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Clients by FAR/Above Phase</h2>
        <div className="space-y-3">
          {byPhase.map(({ phase, count }) => {
            const pct = orgs.length ? Math.round((count / orgs.length) * 100) : 0
            return (
              <div key={phase} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">Phase {phase}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-16 text-right">{count} client{count !== 1 ? 's' : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
