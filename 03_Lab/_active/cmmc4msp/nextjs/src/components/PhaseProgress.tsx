'use client'
import Link from 'next/link'
import { PHASE_CONFIG } from '@/lib/constants'
import { ProgramControl } from '@/lib/types'
import { CheckCircleIcon, LockClosedIcon } from '@heroicons/react/24/solid'

interface PhaseProgressProps {
  programControls: ProgramControl[]
  currentPhase: string
  orgSlug?: string
}

export function PhaseProgress({ programControls, currentPhase, orgSlug }: PhaseProgressProps) {
  return (
    <div className="space-y-3">
      {PHASE_CONFIG.map((p) => {
        const phaseControls = programControls.filter(
          (pc) => pc.control_definition?.far_above_phase === p.phase && pc.is_applicable
        )
        const total = phaseControls.length || p.controls
        const complete = phaseControls.filter((pc) => pc.status === 'fully_implemented').length
        const pct = total > 0 ? Math.round((complete / total) * 100) : 0
        const isUnlocked = phaseControls.some((pc) => pc.is_phase_unlocked)
        const isAllComplete = complete === total && total > 0
        const isCurrent = p.phase === currentPhase
        const href = orgSlug ? `/${orgSlug}/controls?phase=${p.phase}` : undefined

        const inner = (
          <div
            className={`rounded-lg border p-3 transition-shadow ${
              isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
            } ${href ? 'hover:shadow-sm cursor-pointer' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    isAllComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {p.phase}
                </span>
                <span className="text-sm font-medium text-gray-700">{p.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {isAllComplete ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                ) : !isUnlocked ? (
                  <LockClosedIcon className="w-4 h-4 text-gray-400" />
                ) : null}
                <span className="text-xs text-gray-500">
                  {complete}/{total}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  isAllComplete ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{pct}% complete</p>
          </div>
        )

        return href ? (
          <Link key={p.phase} href={href}>{inner}</Link>
        ) : (
          <div key={p.phase}>{inner}</div>
        )
      })}
    </div>
  )
}
