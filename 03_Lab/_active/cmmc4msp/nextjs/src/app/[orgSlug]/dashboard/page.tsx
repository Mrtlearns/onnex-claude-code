'use client'
import { useQuery, useSubscription } from '@apollo/client'
import { GET_ORG_BY_SLUG, GET_PROGRAM_DASHBOARD } from '@/graphql/queries'
import { SUBSCRIBE_PROGRAM_DASHBOARD } from '@/graphql/subscriptions'
import { SPRSGauge } from '@/components/SPRSGauge'
import { PhaseProgress } from '@/components/PhaseProgress'
import { DomainHeatmap } from '@/components/DomainHeatmap'
import { ActivityFeed } from '@/components/ActivityFeed'

interface DashboardProps {
  params: { orgSlug: string }
}

export default function DashboardPage({ params }: DashboardProps) {
  const { orgSlug } = params

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

  // Live score subscription
  const { data: liveData } = useSubscription(SUBSCRIBE_PROGRAM_DASHBOARD, {
    variables: { programId },
    skip: !programId,
  })

  const liveProgram = liveData?.programs_by_pk || dashData?.programs_by_pk || program

  const programControls = dashData?.program_controls || []
  const totalControls = dashData?.program_controls_aggregate?.aggregate?.count || 0
  const completeCount = dashData?.fully_implemented?.aggregate?.count || 0
  const openAssignments = 0 // would need a separate query

  if (orgLoading || dashLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
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
        <p>Organization not found</p>
      </div>
    )
  }

  const sprsScore = liveProgram?.sprs_score ?? 0
  const currentPhase = liveProgram?.current_phase ?? '1'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{org.name}</h1>
        <p className="text-sm text-gray-500">
          CMMC Level 2 Dashboard — Phase {currentPhase} of 5
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Controls Complete</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {completeCount}
            <span className="text-sm font-normal text-gray-400">/{totalControls}</span>
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">SPRS Score</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              sprsScore < 0
                ? 'text-red-600'
                : sprsScore < 70
                ? 'text-amber-500'
                : 'text-green-600'
            }`}
          >
            {sprsScore}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Open Assignments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{openAssignments}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Program Status</p>
          <p className="text-sm font-semibold text-gray-800 mt-2 capitalize">
            {(liveProgram?.status || 'scoping').replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* SPRS Gauge */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 self-start">Live SPRS Score</h2>
          <SPRSGauge score={sprsScore} />
          <p className="text-xs text-gray-400 mt-3 text-center">
            FAR Above score: {liveProgram?.far_above_score ?? 0}
          </p>
        </div>

        {/* Phase Progress */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Phase Progress</h2>
          <PhaseProgress programControls={programControls} currentPhase={currentPhase} />
        </div>

        {/* Activity Feed */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>
          <ActivityFeed orgId={org.id} />
        </div>
      </div>

      {/* Domain Heatmap */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Domain Coverage Heatmap</h2>
        <DomainHeatmap programControls={programControls} />
      </div>
    </div>
  )
}
