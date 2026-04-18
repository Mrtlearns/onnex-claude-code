'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { PlusIcon } from '@heroicons/react/24/outline'
import { GET_ORGS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'

const PROGRAM_STATUS: Record<string, { label: string; color: string }> = {
  scoping:          { label: 'Scoping',          color: 'bg-gray-100 text-gray-600' },
  in_progress:      { label: 'In Progress',      color: 'bg-blue-100 text-blue-700' },
  assessment_ready: { label: 'Assessment Ready', color: 'bg-amber-100 text-amber-700' },
  certified:        { label: 'Certified',        color: 'bg-emerald-100 text-emerald-700' },
}

export default function MspDashboard() {
  const { data: session } = useSession()
  const { data, loading, error } = useQuery(GET_ORGS, { skip: !session })
  const orgs = data?.orgs ?? []

  const totalOrgs = orgs.length
  const avgSprs = orgs.length
    ? Math.round(orgs.reduce((s: number, o: any) => s + (o.programs?.[0]?.sprs_score ?? 0), 0) / orgs.length)
    : 0
  const assessmentReady = orgs.filter((o: any) => o.programs?.[0]?.status === 'assessment_ready').length

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MSP Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">All client organizations</p>
        </div>
        <Link
          href="/onboard"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Onboard Client
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Total Clients</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalOrgs}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg SPRS Score</p>
          <p className={`text-3xl font-bold mt-1 ${getSPRSColor(avgSprs)}`}>{avgSprs || '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Assessment Ready</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{assessmentReady}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Client Organizations</h2>
          <Link href="/msp/clients" className="text-sm text-blue-600 hover:text-blue-700">View all →</Link>
        </div>
        {orgs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No clients yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Organization</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">SPRS</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Phase</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orgs.map((org: any) => {
                const prog = org.programs?.[0]
                const sprs = prog?.sprs_score ?? 0
                const psCfg = PROGRAM_STATUS[prog?.status] ?? PROGRAM_STATUS.scoping
                return (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/${org.slug}/dashboard`} className="font-medium text-blue-700 hover:underline">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-bold ${getSPRSColor(sprs)}`}>{sprs}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {prog ? `Phase ${prog.current_phase}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {prog ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${psCfg.color}`}>
                          {psCfg.label}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
