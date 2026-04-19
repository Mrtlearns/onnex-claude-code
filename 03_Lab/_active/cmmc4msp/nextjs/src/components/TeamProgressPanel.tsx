'use client'
import { useQuery } from '@apollo/client'
import { GET_ORG_USERS, GET_MY_ASSIGNMENTS } from '@/graphql/queries'

interface TeamProgressPanelProps {
  orgId: string
  programId: string
  currentPhase: string
  userRole: string
}

const OWNER_ROLES = ['client_admin', 'msp_admin', 'super_admin']

function MemberCard({ userId, email, fullName, role, currentPhase }: {
  userId: string
  email: string
  fullName?: string
  role: string
  programId: string
  currentPhase: string
}) {
  const { data } = useQuery(GET_MY_ASSIGNMENTS, {
    variables: { userId },
  })

  const all = data?.assignments ?? []
  const phaseAll = all.filter(
    (a: any) => a.program_control?.control_definition?.far_above_phase === currentPhase
  )
  const phaseComplete = phaseAll.filter((a: any) => a.status === 'accepted').length
  const phaseTotal = phaseAll.length
  const pct = phaseTotal > 0 ? Math.round((phaseComplete / phaseTotal) * 100) : 0

  const overallComplete = all.filter((a: any) => a.status === 'accepted').length
  const overallTotal = all.length

  const roleColors: Record<string, string> = {
    client_admin: 'bg-purple-100 text-purple-700',
    client_user: 'bg-gray-100 text-gray-600',
    msp_admin: 'bg-blue-100 text-blue-700',
    super_admin: 'bg-indigo-100 text-indigo-700',
  }

  const displayName = fullName ?? email.split('@')[0]

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{displayName}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[role] ?? 'bg-gray-100 text-gray-600'}`}>
            {role.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-gray-500 text-right">
          {overallComplete}/{overallTotal} total
        </p>
      </div>
      <p className="text-xs text-gray-500 mb-1.5">
        Phase {currentPhase}: {phaseComplete}/{phaseTotal} complete
      </p>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct}%</p>
    </div>
  )
}

export function TeamProgressPanel({ orgId, programId, currentPhase, userRole }: TeamProgressPanelProps) {
  const isOwner = OWNER_ROLES.includes(userRole)

  const { data, loading } = useQuery(GET_ORG_USERS, {
    variables: { orgId },
    skip: !orgId || !isOwner,
  })

  if (!isOwner) return null

  const users = data?.users ?? []

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Team Progress — Phase {currentPhase}</h2>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Team Progress</h2>
        <p className="text-sm text-gray-400">No team members assigned yet. Use the Team page to invite members.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        Team Progress — Phase {currentPhase}
        <span className="ml-2 text-xs text-gray-400 font-normal">{users.length} members</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {users.map((u: any) => (
          <MemberCard
            key={u.id}
            userId={u.id}
            email={u.email}
            fullName={u.full_name}
            role={u.role}
            programId={programId}
            currentPhase={currentPhase}
          />
        ))}
      </div>
    </div>
  )
}
