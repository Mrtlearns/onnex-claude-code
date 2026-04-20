'use client'
import { useQuery } from '@apollo/client'
import { GET_ORG_BY_SLUG, GET_ORG_USERS } from '@/graphql/queries'
import { UserGroupIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

interface TeamPageProps {
  params: { orgSlug: string }
}

const ROLE_STYLES: Record<string, { label: string; cls: string }> = {
  super_admin:   { label: 'Super Admin',   cls: 'bg-violet-100 text-violet-800' },
  msp_admin:     { label: 'MSP Admin',     cls: 'bg-blue-100 text-blue-800' },
  client_admin:  { label: 'Admin',         cls: 'bg-emerald-100 text-emerald-800' },
  client_user:   { label: 'Member',        cls: 'bg-gray-100 text-gray-700' },
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']

export default function TeamPage({ params }: TeamPageProps) {
  const { orgSlug } = params

  const { data: orgData, loading: orgLoading } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const org = orgData?.orgs?.[0]
  const orgId = org?.id

  const { data: usersData, loading: usersLoading } = useQuery(GET_ORG_USERS, {
    variables: { orgId },
    skip: !orgId,
  })

  const users = usersData?.users || []
  const activeAssignments = users.reduce(
    (sum: number, u: any) => sum + (u.assignments_aggregate?.aggregate?.count || 0), 0
  )

  if (orgLoading || usersLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Team</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Team Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Active Assignments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeAssignments}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Primary Contact</p>
          <p className="text-sm font-semibold text-gray-800 mt-1 truncate">
            {org?.primary_contact_name || '—'}
          </p>
        </div>
      </div>

      {/* Members list */}
      {users.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-base font-semibold text-gray-600 mb-2">No team members found</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Invite users through the team invitation system to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{users.length} Members</p>
          </div>
          <div className="divide-y divide-gray-100">
            {users.map((u: any, idx: number) => {
              const roleStyle = ROLE_STYLES[u.role] || { label: u.role, cls: 'bg-gray-100 text-gray-700' }
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
              const openTasks = u.assignments_aggregate?.aggregate?.count || 0
              return (
                <div key={u.id} className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {initials(u.full_name, u.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {u.full_name || u.email}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleStyle.cls}`}>
                        {roleStyle.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <EnvelopeIcon className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{openTasks}</p>
                    <p className="text-xs text-gray-400">open tasks</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
