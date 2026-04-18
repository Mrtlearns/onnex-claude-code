'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { GET_ORGS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'

export default function MspClients() {
  const { data: session } = useSession()
  const { data, loading } = useQuery(GET_ORGS, { skip: !session })
  const orgs = data?.orgs ?? []

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500 mt-1">{orgs.length} client organizations</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {orgs.map((org: any) => {
          const prog = org.programs?.[0]
          const sprs = prog?.sprs_score ?? 0
          return (
            <Link
              key={org.id}
              href={`/${org.slug}/dashboard`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                    {org.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {prog ? `Phase ${prog.current_phase}` : 'No program'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">SPRS</p>
                  <p className={`text-xl font-bold ${getSPRSColor(sprs)}`}>{sprs}</p>
                </div>
              </div>
              {prog && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{prog.status?.replace(/_/g, ' ')}</span>
                    <span>→ Dashboard</span>
                  </div>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
