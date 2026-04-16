'use client'
import { useQuery } from '@apollo/client'
import { GET_ORG_BY_SLUG } from '@/graphql/queries'
import { UserGroupIcon } from '@heroicons/react/24/outline'

interface TeamPageProps {
  params: { orgSlug: string }
}

export default function TeamPage({ params }: TeamPageProps) {
  const { orgSlug } = params

  const { data: orgData } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const org = orgData?.orgs?.[0]

  // Build per-member stats from assignments
  // In a real impl this would query users table; for MVP we aggregate from visible assignments
  const stats = {
    totalMembers: '—',
    activeAssignments: '—',
    completedThisMonth: '—',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Team</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Team Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalMembers}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Active Assignments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeAssignments}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Completed This Month</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completedThisMonth}</p>
        </div>
      </div>

      {/* Placeholder */}
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-base font-semibold text-gray-600 mb-2">Team Management</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Team members are managed through Authentik. Assignments and per-person contribution
          stats are tracked automatically as controls are worked.
        </p>
        {org?.primary_contact_name && (
          <div className="mt-6 inline-flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
              {org.primary_contact_name[0]}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">{org.primary_contact_name}</p>
              <p className="text-xs text-gray-500">{org.primary_contact_email}</p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Primary Contact
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
