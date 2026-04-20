'use client'
import { useSession } from 'next-auth/react'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { GET_MY_ASSIGNMENTS } from '@/graphql/queries'
import { PHASE_CONFIG } from '@/lib/constants'

interface PersonalWelcomePanelProps {
  programId: string
  currentPhase: string
  orgSlug: string
}

function pointBadge(val: number | undefined | null) {
  if (!val) return null
  if (val >= 5) return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">HIGH 5pts</span>
  if (val >= 3) return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">MED 3pts</span>
  return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">LOW 1pt</span>
}

export function PersonalWelcomePanel({ programId, currentPhase, orgSlug }: PersonalWelcomePanelProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  const userId = user?.id
  const role: string = user?.role ?? 'client_user'

  // auth.ts resolves Authentik sub → DB users.id (UUID). If the user has no DB row
  // yet, session.user.id falls back to raw sub (integer-pk string for demo users).
  // The regex guard gracefully skips the query in that edge case — matches tasks/page.tsx behavior.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validUserId = UUID_RE.test(userId ?? '') ? userId : null

  const { data, loading } = useQuery(GET_MY_ASSIGNMENTS, {
    variables: { userId: validUserId },
    skip: !validUserId,
  })

  const phaseInfo = PHASE_CONFIG.find((p) => p.phase === currentPhase) ?? PHASE_CONFIG[0]

  const allAssignments = data?.assignments ?? []
  const phaseAssignments = allAssignments.filter(
    (a: any) =>
      a.status !== 'accepted' &&
      a.program_control?.control_definition?.far_above_phase === currentPhase
  )
  const openCount = phaseAssignments.length
  const potentialPts = phaseAssignments.reduce(
    (sum: number, a: any) => sum + (a.program_control?.control_definition?.dod_score_value ?? 0),
    0
  )
  const dueThisWeek = phaseAssignments.filter((a: any) => {
    if (!a.due_date) return false
    const diff = (new Date(a.due_date).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 7
  }).length

  const displayName =
    (user?.name as string | undefined) ??
    (user?.email as string | undefined)?.split('@')[0] ??
    'there'

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    msp_admin: 'MSP Admin',
    client_admin: 'Engagement Owner',
    client_user: 'Team Member',
  }

  if (loading) return <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">Welcome back, {displayName}</p>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            {roleLabel[role] ?? role}
          </span>
        </div>
        {openCount > 0 && (
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-800">
              {openCount} open {openCount === 1 ? 'task' : 'tasks'} in Phase {currentPhase}
            </p>
            <p className="text-xs text-gray-500">
              {dueThisWeek > 0 ? `${dueThisWeek} due this week · ` : ''}
              completing these adds <span className="font-semibold text-green-700">+{potentialPts} SPRS pts</span>
            </p>
          </div>
        )}
      </div>

      {/* Phase context */}
      <div className="bg-white bg-opacity-70 rounded-lg p-3">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">
          Phase {currentPhase} of 5 — {phaseInfo.label}
        </p>
        <p className="text-sm text-gray-700">{(phaseInfo as any).description ?? ''}</p>
        {(phaseInfo as any).unlocks && (
          <p className="text-xs text-gray-500 mt-1">
            Completing this phase unlocks: <span className="font-medium">{(phaseInfo as any).unlocks}</span>
          </p>
        )}
      </div>

      {/* Priority tasks */}
      {phaseAssignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Your biggest wins this phase:</p>
          <div className="space-y-1.5">
            {phaseAssignments.slice(0, 3).map((a: any) => {
              const cd = a.program_control?.control_definition
              const isOverdue = a.due_date && new Date(a.due_date) < new Date()
              return (
                <Link
                  key={a.id}
                  href={`/${orgSlug}/controls/${a.program_control?.id}`}
                  className="flex items-center gap-3 p-2 bg-white bg-opacity-80 rounded-lg hover:bg-opacity-100 transition"
                >
                  {pointBadge(cd?.dod_score_value)}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-gray-800">{cd?.nist_id ?? '—'}</span>
                    <span className="text-xs text-gray-500 ml-2 truncate">{cd?.requirement_text?.slice(0, 60)}…</span>
                  </div>
                  {a.due_date && (
                    <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {isOverdue ? 'Overdue' : new Date(a.due_date).toLocaleDateString()}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
          {phaseAssignments.length > 3 && (
            <Link href={`/${orgSlug}/tasks`} className="text-xs text-blue-600 hover:underline mt-2 block text-right">
              +{phaseAssignments.length - 3} more tasks →
            </Link>
          )}
        </div>
      )}

      {openCount === 0 && (
        <p className="text-sm text-green-700 font-medium">
          No open tasks in Phase {currentPhase} — all caught up! Check the Controls page for anything not yet assigned.
        </p>
      )}
    </div>
  )
}
