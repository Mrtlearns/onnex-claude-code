'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  HeartIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { GET_ADMIN_MSPS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function PlatformOverview() {
  const { data: session } = useSession()
  const user = session?.user as any

  if (session && user?.role !== 'super_admin') {
    redirect('/')
  }

  const { data, loading } = useQuery(GET_ADMIN_MSPS, { skip: !session })
  const msps = data?.msps ?? []
  const totalOrgs = msps.reduce((s: number, m: any) => s + (m.orgs_aggregate?.aggregate?.count ?? 0), 0)

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Onnex — CMMC Compliance OS</p>
        </div>
        <Link
          href="/platform/msps"
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <BuildingOffice2Icon className="w-4 h-4" />
          Manage MSPs
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard label="MSP Accounts" value={msps.length} sub="Active partners" />
        <KpiCard label="Client Orgs" value={totalOrgs} sub="Across all MSPs" />
        <KpiCard label="System Status" value="Operational" color="text-emerald-600" sub="All services healthy" />
        <KpiCard label="Platform" value="CMMC4MSP" sub="Compliance OS" />
      </div>

      {/* MSP list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">MSP Partners</h2>
          <Link href="/platform/msps" className="text-sm text-violet-600 hover:text-violet-700">View all →</Link>
        </div>
        {msps.length === 0 ? (
          <div className="p-12 text-center">
            <BuildingOffice2Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No MSP accounts yet.</p>
            <Link href="/admin" className="mt-4 inline-block text-sm text-violet-600 hover:underline">
              Onboard first MSP →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">MSP Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Client Orgs</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {msps.map((msp: any) => (
                <tr key={msp.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{msp.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {msp.orgs_aggregate?.aggregate?.count ?? 0}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href="/platform/clients"
                      className="text-violet-600 hover:underline text-xs"
                    >
                      View clients
                    </Link>
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
