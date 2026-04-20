'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { GET_ADMIN_ORGS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'

const STATUS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-700',
}

export default function PlatformClients() {
  const { data: session } = useSession()
  const { data, loading } = useQuery(GET_ADMIN_ORGS, { skip: !session })
  const orgs = data?.orgs ?? []

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">All Clients</h1>
        <p className="text-sm text-gray-500 mt-1">{orgs.length} organizations across all MSPs</p>
      </div>

      {orgs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <BuildingOfficeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No client organizations yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Organization</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">MSP</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">SPRS</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Phase</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orgs.map((org: any) => {
                const prog = org.programs?.[0]
                const sprs = prog?.sprs_score ?? 0
                const sc = STATUS[org.status] ?? STATUS.inactive
                return (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/${org.slug}/dashboard`} className="font-medium text-violet-700 hover:underline">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{org.msp?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`font-bold ${getSPRSColor(sprs)}`}>{sprs}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {prog ? `Phase ${prog.current_phase}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc}`}>
                        {org.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
