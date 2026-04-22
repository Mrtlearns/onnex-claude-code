'use client'
import { useQuery, useSubscription } from '@apollo/client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { GET_ORG_BY_SLUG, GET_PROGRAM_DASHBOARD, GET_MY_ASSIGNMENTS } from '@/graphql/queries'
import { SUBSCRIBE_PROGRAM_DASHBOARD } from '@/graphql/subscriptions'
import { SPRSGauge } from '@/components/SPRSGauge'
import { PhaseProgress } from '@/components/PhaseProgress'
import { DomainHeatmap } from '@/components/DomainHeatmap'
import { ActivityFeed } from '@/components/ActivityFeed'
import { AlsoSatisfiedPanel } from '@/components/AlsoSatisfiedPanel'
import { PersonalWelcomePanel } from '@/components/PersonalWelcomePanel'
import { TeamProgressPanel } from '@/components/TeamProgressPanel'
import { ShieldCheckIcon, ClipboardDocumentListIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'

interface DashboardProps {
  params: { orgSlug: string }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MspActionsPanel({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-blue-800 mb-3">MSP Admin Actions</h2>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${orgSlug}/reports`}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Generate Audit Package
        </Link>
        <Link
          href={`/${orgSlug}/controls`}
          className="text-xs px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 transition-colors"
        >
          Review Assessments
        </Link>
        <Link
          href={`/${orgSlug}/suggestions`}
          className="text-xs px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 transition-colors"
        >
          AI Suggestions
        </Link>
      </div>
    </div>
  )
}

function MyTasksWidget({ userId, orgSlug }: { userId: string; orgSlug: string }) {
  const { data, loading } = useQuery(GET_MY_ASSIGNMENTS, {
    variables: { userId },
    skip: !userId,
  })
  const tasks = (data?.assignments ?? []).filter((a: any) => a.status !== 'accepted')

  if (loading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <ClipboardDocumentListIcon className="w-4 h-4 text-gray-400" />
        My Open Tasks
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No open tasks — all caught up!</p>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 5).map((t: any) => (
            <Link
              key={t.id}
              href={`/${orgSlug}/tasks`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {t.program_control?.control_definition?.nist_id ?? 'Task'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {t.program_control?.control_definition?.family ?? ''}
                </p>
              </div>
              {t.due_date && (
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  {new Date(t.due_date).toLocaleDateString()}
                </span>
              )}
            </Link>
          ))}
          {tasks.length > 5 && (
            <Link href={`/${orgSlug}/tasks`} className="text-xs text-blue-600 hover:underline block text-center pt-1">
              +{tasks.length - 5} more tasks
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function ClientUserView({ userId, orgSlug, program, programId }: {
  userId: string
  orgSlug: string
  program: any
  programId: string
}) {
  const currentPhase = program?.current_phase ?? '1'
  const clientCmmcLevel = program?.cmmc_level ?? 2
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-sm text-gray-500">
          {program?.name ?? `CMMC Level ${clientCmmcLevel}`} — Phase {currentPhase} of {clientCmmcLevel === 3 ? 6 : 5}
        </p>
      </div>

      {/* Personal context panel */}
      {programId && (
        <PersonalWelcomePanel programId={programId} currentPhase={currentPhase} orgSlug={orgSlug} />
      )}

      <div className="grid grid-cols-2 gap-4">
        <MyTasksWidget userId={userId} orgSlug={orgSlug} />

        {/* Quick upload CTA */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ArrowUpTrayIcon className="w-4 h-4 text-gray-400" />
            Submit Evidence
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Upload policies, screenshots, or documents to satisfy a control requirement.
          </p>
          <Link
            href={`/${orgSlug}/artifacts`}
            className="block text-center text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Artifact
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">My Controls</h2>
        <Link href={`/${orgSlug}/controls`} className="text-sm text-blue-600 hover:underline">
          View controls assigned to me →
        </Link>
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage({ params }: DashboardProps) {
  const { orgSlug } = params
  const { data: session } = useSession()
  const user = session?.user as any
  const role: string = user?.role ?? 'client_user'

  const { data: orgData, loading: orgLoading } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const org = orgData?.orgs?.[0]
  const program = org?.programs?.[0]
  const programId = program?.id

  const { data: dashData, loading: dashLoading } = useQuery(GET_PROGRAM_DASHBOARD, {
    variables: { programId },
    skip: !programId,
  })

  const { data: liveData } = useSubscription(SUBSCRIBE_PROGRAM_DASHBOARD, {
    variables: { programId },
    skip: !programId,
  })

  const liveProgram = liveData?.programs_by_pk || dashData?.programs_by_pk || program

  const programControls = dashData?.program_controls || []
  const totalControls = dashData?.program_controls_aggregate?.aggregate?.count || 0
  const completeCount = dashData?.fully_implemented?.aggregate?.count || 0

  if (orgLoading || dashLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="text-center py-16 text-gray-400">
        <ShieldCheckIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Organization not found</p>
      </div>
    )
  }

  // client_user gets a simplified view
  if (role === 'client_user') {
    return <ClientUserView userId={user?.id} orgSlug={orgSlug} program={liveProgram} programId={programId ?? ''} />
  }

  const sprsScore = liveProgram?.sprs_score ?? null
  const readinessPct = liveProgram?.readiness_pct ?? null
  const cmmcLevel: 2 | 3 = (liveProgram?.cmmc_level ?? 2) as 2 | 3
  const showL3Preview: boolean = liveProgram?.show_l3_preview ?? false
  const currentPhase = liveProgram?.current_phase ?? '1'
  const totalPhases = cmmcLevel === 3 ? 6 : 5
  const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

  async function toggleL3Preview() {
    if (!programId) return
    await fetch(`${API_URL}/api/programs/${programId}/l3-preview`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !showL3Preview }),
    })
    // Hasura subscription will update liveProgram automatically
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{org.name}</h1>
          <p className="text-sm text-gray-500">
            CMMC Level {cmmcLevel} Dashboard — Phase {currentPhase} of {totalPhases}
          </p>
        </div>
        {/* MSP/super_admin quick-nav back to portfolio */}
        {(role === 'msp_admin' || role === 'super_admin') && (
          <Link
            href={role === 'super_admin' ? '/platform/clients' : '/msp'}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-2.5 py-1.5"
          >
            ← Portfolio
          </Link>
        )}
      </div>

      {/* MSP/super_admin action panel */}
      {(role === 'msp_admin' || role === 'super_admin') && (
        <MspActionsPanel orgSlug={orgSlug} />
      )}

      {/* L3 advisory toggle — Level 2 programs only, MSP/admin roles */}
      {cmmcLevel === 2 && (role === 'msp_admin' || role === 'super_admin' || role === 'client_admin') && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${showL3Preview ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <div>
            <p className="text-sm font-medium text-gray-800">Level 3 Advisory Preview</p>
            <p className="text-xs text-gray-500">Show 35 additional NIST SP 800-172 requirements as read-only advisory on Controls page</p>
          </div>
          <button
            onClick={toggleL3Preview}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showL3Preview ? 'bg-amber-500' : 'bg-gray-300'}`}
            role="switch"
            aria-checked={showL3Preview}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showL3Preview ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      )}

      {/* Personal welcome panel — shown to client_admin, msp_admin, super_admin */}
      {programId && (
        <PersonalWelcomePanel programId={programId} currentPhase={currentPhase} orgSlug={orgSlug} />
      )}

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        <Link href={`/${orgSlug}/controls?status=fully_implemented`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Controls Complete</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {completeCount}
            <span className="text-sm font-normal text-gray-400">/{totalControls}</span>
          </p>
        </Link>
        <Link href={`/${orgSlug}/controls`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
          {cmmcLevel === 2 ? (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wider">SPRS Score</p>
              <p className={`text-2xl font-bold mt-1 ${
                (sprsScore ?? 0) < 0 ? 'text-red-600' : (sprsScore ?? 0) < 70 ? 'text-amber-500' : 'text-green-600'
              }`}>
                {sprsScore ?? '—'}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Readiness</p>
              <p className={`text-2xl font-bold mt-1 ${
                (readinessPct ?? 0) < 50 ? 'text-red-600' : (readinessPct ?? 0) < 80 ? 'text-amber-500' : 'text-green-600'
              }`}>
                {readinessPct ?? 0}%
              </p>
            </>
          )}
        </Link>
        <Link href={`/${orgSlug}/tasks`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Open Assignments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">—</p>
        </Link>
        <Link href={`/${orgSlug}/reports`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Program Status</p>
          <p className="text-sm font-semibold text-gray-800 mt-2 capitalize">
            {(liveProgram?.status || 'scoping').replace(/_/g, ' ')}
          </p>
        </Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center">
          {cmmcLevel === 2 ? (
            <>
              <h2 className="text-sm font-semibold text-gray-700 mb-4 self-start">Live SPRS Score</h2>
              <SPRSGauge score={sprsScore ?? 0} />
              <p className="text-xs text-gray-400 mt-3 text-center">
                FAR Above score: {liveProgram?.far_above_score ?? 0}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-gray-700 mb-4 self-start">DIBCAC Readiness</h2>
              <div className="flex flex-col items-center justify-center flex-1 py-4">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={(readinessPct ?? 0) >= 80 ? '#22c55e' : (readinessPct ?? 0) >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${(readinessPct ?? 0)} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{readinessPct ?? 0}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">DIBCAC Assessment Target</p>
              </div>
            </>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Phase Progress</h2>
          <PhaseProgress programControls={programControls} currentPhase={currentPhase} orgSlug={orgSlug} cmmcLevel={cmmcLevel} />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>
          <ActivityFeed orgId={org.id} />
        </div>
      </div>

      {programId && (
        <AlsoSatisfiedPanel programId={programId} orgSlug={orgSlug} />
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Domain Coverage Heatmap</h2>
        <DomainHeatmap programControls={programControls} orgSlug={orgSlug} />
      </div>

      {/* Team progress — owners only */}
      {programId && org?.id && (
        <TeamProgressPanel
          orgId={org.id}
          programId={programId}
          currentPhase={currentPhase}
          userRole={role}
        />
      )}
    </div>
  )
}
