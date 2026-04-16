'use client'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { GET_ORGS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'
import { PlusIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-600' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-700' },
}

const PROGRAM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scoping: { label: 'Scoping', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  assessment_ready: { label: 'Assessment Ready', color: 'bg-yellow-100 text-yellow-700' },
  certified: { label: 'Certified', color: 'bg-green-100 text-green-700' },
}

export default function MSPDashboard() {
  const { data, loading, error } = useQuery(GET_ORGS)

  const orgs = data?.orgs || []
  const totalOrgs = orgs.length
  const avgSprs =
    orgs.length > 0
      ? Math.round(
          orgs.reduce((sum: number, org: any) => {
            const score = org.programs?.[0]?.sprs_score ?? 0
            return sum + score
          }, 0) / orgs.length
        )
      : 0
  const pendingAssessments = orgs.reduce((sum: number, org: any) => {
    return sum + (org.programs?.[0]?.status === 'assessment_ready' ? 1 : 0)
  }, 0)

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error loading data: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CMMC Compliance OS</h1>
          <p className="text-sm text-gray-500 mt-1">MSP Dashboard — All Clients</p>
        </div>
        <Link
          href="/onboard"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Onboard New Client
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Total Clients</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalOrgs}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Avg SPRS Score</p>
          <p className={`text-3xl font-bold mt-1 ${getSPRSColor(avgSprs)}`}>{avgSprs}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Assessment Ready</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{pendingAssessments}</p>
        </div>
      </div>

      {/* Client Table */}
      {orgs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <BuildingOfficeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-500">No clients yet</p>
          <p className="text-sm text-gray-400 mb-6">Get started by onboarding your first defense contractor client.</p>
          <Link
            href="/onboard"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Onboard First Client
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Organization</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">SPRS Score</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phase</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Program Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Org Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orgs.map((org: any) => {
                const program = org.programs?.[0]
                const sprs = program?.sprs_score ?? 0
                const statusCfg = STATUS_CONFIG[org.status] || STATUS_CONFIG.inactive
                const progCfg =
                  PROGRAM_STATUS_CONFIG[program?.status] || PROGRAM_STATUS_CONFIG.scoping

                return (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${org.slug}/dashboard`}
                        className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${getSPRSColor(sprs)}`}>{sprs}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {program ? `Phase ${program.current_phase}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {program ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${progCfg.color}`}
                        >
                          {progCfg.label}
                        </span>
                      ) : (
                        <span className="text-gray-400">No program</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(org.created_at).toLocaleDateString()}
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
