'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { PlusIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline'
import { GET_ADMIN_MSPS } from '@/graphql/queries'

export default function PlatformMsps() {
  const { data: session } = useSession()
  const { data, loading } = useQuery(GET_ADMIN_MSPS, { skip: !session })
  const msps = data?.msps ?? []

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MSP Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">{msps.length} registered MSP partners</p>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Onboard MSP
        </Link>
      </div>

      {msps.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <BuildingOffice2Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-500">No MSP accounts</p>
          <Link href="/admin" className="mt-4 inline-block text-sm text-violet-600 hover:underline">
            Onboard your first MSP →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">MSP Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Client Orgs</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {msps.map((msp: any) => (
                <tr key={msp.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{msp.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {msp.orgs_aggregate?.aggregate?.count ?? 0}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {new Date(msp.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
