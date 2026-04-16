'use client'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { GET_ORG_BY_SLUG, GET_PROGRAM_CONTROLS, GET_PROGRAM_CONTROLS_UNFILTERED } from '@/graphql/queries'
import { ControlStatusBadge } from '@/components/ControlStatusBadge'
import { ControlStatus } from '@/lib/types'
import { PHASE_CONFIG } from '@/lib/constants'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface ControlsPageProps {
  params: { orgSlug: string }
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'not_yet_assessed', label: 'Not Assessed' },
  { value: 'not_yet_addressed', label: 'Not Addressed' },
  { value: 'implementation_planned', label: 'Planned' },
  { value: 'implementation_begun', label: 'In Progress' },
  { value: 'fully_implemented', label: 'Complete' },
  { value: 'not_applicable', label: 'N/A' },
]

export default function ControlsPage({ params }: ControlsPageProps) {
  const { orgSlug } = params
  const [phaseFilter, setPhaseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: orgData, loading: orgLoading } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const programId = orgData?.orgs?.[0]?.programs?.[0]?.id

  // Use unfiltered query and filter client-side for flexibility
  const { data, loading } = useQuery(GET_PROGRAM_CONTROLS_UNFILTERED, {
    variables: { programId },
    skip: !programId,
  })

  const allControls = data?.program_controls || []

  const filtered = allControls.filter((pc: any) => {
    const def = pc.control_definition
    if (phaseFilter && def?.far_above_phase !== phaseFilter) return false
    if (statusFilter && pc.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !def?.nist_id?.toLowerCase().includes(q) &&
        !def?.cmmc_id?.toLowerCase().includes(q) &&
        !def?.family_abbrev?.toLowerCase().includes(q) &&
        !def?.requirement_text?.toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })

  if (orgLoading || loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Controls</h1>
        <span className="text-sm text-gray-500">{filtered.length} controls</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search NIST ID, control text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Phases</option>
          {PHASE_CONFIG.map((p) => (
            <option key={p.phase} value={p.phase}>
              Phase {p.phase} — {p.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Controls Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-24">NIST ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-24">CMMC ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-16">Family</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Requirement</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-20">Phase</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-32">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No controls match your filters
                </td>
              </tr>
            ) : (
              filtered.map((pc: any) => {
                const def = pc.control_definition
                return (
                  <tr key={pc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${orgSlug}/controls/${pc.id}`}
                        className="font-mono text-blue-700 font-medium hover:underline"
                      >
                        {def?.nist_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{def?.cmmc_id}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {def?.family_abbrev}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs">
                      <span className="line-clamp-2">{def?.requirement_text}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">P{def?.far_above_phase}</td>
                    <td className="px-4 py-3">
                      <ControlStatusBadge status={pc.status as ControlStatus} size="sm" />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
