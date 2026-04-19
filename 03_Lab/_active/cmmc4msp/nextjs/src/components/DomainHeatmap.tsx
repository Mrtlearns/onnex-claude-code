'use client'
import { useState } from 'react'
import Link from 'next/link'
import { DOMAIN_ABBREVS } from '@/lib/constants'
import { ProgramControl } from '@/lib/types'

interface DomainHeatmapProps {
  programControls: ProgramControl[]
  orgSlug?: string
}

function getHeatmapBg(pct: number): string {
  if (pct === 0) return 'bg-gray-50 text-gray-400'
  if (pct < 25) return 'bg-blue-100 text-blue-800'
  if (pct < 50) return 'bg-blue-200 text-blue-800'
  if (pct < 75) return 'bg-blue-400 text-white'
  if (pct < 100) return 'bg-blue-600 text-white'
  return 'bg-blue-800 text-white'
}

export function DomainHeatmap({ programControls, orgSlug }: DomainHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ abbrev: string; x: number; y: number } | null>(null)

  const domains = Object.keys(DOMAIN_ABBREVS)

  const domainStats = domains.map((abbrev) => {
    const controls = programControls.filter(
      (pc) => pc.control_definition?.family_abbrev === abbrev && pc.is_applicable
    )
    const total = controls.length
    const complete = controls.filter((pc) => pc.status === 'fully_implemented').length
    const pct = total > 0 ? Math.round((complete / total) * 100) : 0
    return { abbrev, total, complete, pct }
  })

  return (
    <div className="relative">
      <div className="grid grid-cols-7 gap-2">
        {domainStats.map((d) => {
          const cell = (
            <div
              className={`rounded-lg p-2 cursor-pointer transition-transform hover:scale-105 ${getHeatmapBg(d.pct)}`}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({ abbrev: d.abbrev, x: rect.left, y: rect.top })
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <p className="text-xs font-bold text-center">{d.abbrev}</p>
              <p className="text-xs text-center">{d.pct}%</p>
            </div>
          )
          return orgSlug ? (
            <Link key={d.abbrev} href={`/${orgSlug}/controls?domain=${d.abbrev}`}>{cell}</Link>
          ) : (
            <div key={d.abbrev}>{cell}</div>
          )
        })}
      </div>
      {tooltip && (
        <div className="fixed z-50 bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 40 }}
        >
          {DOMAIN_ABBREVS[tooltip.abbrev]}
          {' — '}
          {domainStats.find((d) => d.abbrev === tooltip.abbrev)?.complete}/
          {domainStats.find((d) => d.abbrev === tooltip.abbrev)?.total} controls
        </div>
      )}
    </div>
  )
}
