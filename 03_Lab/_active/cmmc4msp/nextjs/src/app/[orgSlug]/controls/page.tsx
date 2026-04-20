'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  GET_ORG_BY_SLUG,
  GET_PROGRAM_CONTROLS_UNFILTERED,
  GET_ORG_USERS,
} from '@/graphql/queries'
import { ControlStatusBadge } from '@/components/ControlStatusBadge'
import { ControlStatus } from '@/lib/types'
import { PHASE_CONFIG } from '@/lib/constants'
import {
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

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

const ASSIGNABLE_ROLES = new Set(['client_admin', 'msp_admin', 'super_admin'])

export default function ControlsPage({ params }: ControlsPageProps) {
  const { orgSlug } = params
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const user = session?.user as any
  const role: string = user?.role ?? 'client_user'
  const canAssign = ASSIGNABLE_ROLES.has(role)
  const API = process.env.NEXT_PUBLIC_API_URL || ''

  // Filters
  const [phaseFilter, setPhaseFilter] = useState(searchParams.get('phase') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [domainFilter, setDomainFilter] = useState(searchParams.get('domain') || '')
  const [search, setSearch] = useState('')

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAssignModal, setShowAssignModal] = useState(false)

  // Assignment form
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const [sending, setSending] = useState(false)
  const [sendToast, setSendToast] = useState(false)

  const { data: orgData, loading: orgLoading } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const org = orgData?.orgs?.[0]
  const orgId = org?.id
  const programId = org?.programs?.[0]?.id

  const { data, loading } = useQuery(GET_PROGRAM_CONTROLS_UNFILTERED, {
    variables: { programId },
    skip: !programId,
  })

  const { data: usersData } = useQuery(GET_ORG_USERS, {
    variables: { orgId },
    skip: !orgId || !canAssign,
  })

  const orgUsers = (usersData?.users || []).filter(
    (u: any) => u.role === 'client_user' || u.role === 'client_admin'
  )

  const allControls = data?.program_controls || []

  const filtered = allControls.filter((pc: any) => {
    const def = pc.control_definition
    if (phaseFilter && def?.far_above_phase !== phaseFilter) return false
    if (statusFilter && pc.status !== statusFilter) return false
    if (domainFilter && def?.family_abbrev !== domainFilter) return false
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

  // ── Selection helpers ──────────────────────────────────────────────────────

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((pc: any) => pc.id)))
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setShowAssignModal(false)
    setAssigneeId('')
    setDueDate('')
    setInstructions('')
  }

  // ── Send requests ──────────────────────────────────────────────────────────

  async function handleSendRequests() {
    if (!assigneeId || selectedIds.size === 0) return
    setSending(true)
    try {
      const res = await fetch(`${API}/api/assignments/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.accessToken}`,
        },
        body: JSON.stringify({
          program_id: programId,
          assignee_id: assigneeId,
          control_ids: Array.from(selectedIds),
          ...(dueDate ? { due_date: dueDate } : {}),
          ...(instructions ? { instructions } : {}),
        }),
      })
      if (res.ok) {
        setSendToast(true)
        setTimeout(() => setSendToast(false), 4000)
        clearSelection()
      }
    } finally {
      setSending(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

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
      {/* Success toast */}
      {sendToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
          Evidence requests sent successfully
        </div>
      )}

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
        {domainFilter && (
          <button
            onClick={() => setDomainFilter('')}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-50 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100"
          >
            Domain: {domainFilter} ×
          </button>
        )}
      </div>

      {/* Controls Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {canAssign && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label="Select all"
                  />
                </th>
              )}
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
                <td colSpan={canAssign ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No controls match your filters
                </td>
              </tr>
            ) : (
              filtered.map((pc: any) => {
                const def = pc.control_definition
                const isSelected = selectedIds.has(pc.id)
                return (
                  <tr
                    key={pc.id}
                    className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {canAssign && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(pc.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Select ${def?.nist_id}`}
                        />
                      </td>
                    )}
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

      {/* Floating action bar */}
      {canAssign && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-sm font-medium">
            {selectedIds.size} control{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            Request Evidence
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Clear selection"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Request Evidence</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Assign {selectedIds.size} control{selectedIds.size !== 1 ? 's' : ''} to a team member for evidence collection.
            </p>

            <div className="space-y-3">
              {/* Assign to */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Assign to <span className="text-red-500">*</span>
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  required
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select team member…</option>
                  {orgUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Due date (optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Instructions (optional)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  placeholder="Describe what evidence you need…"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendRequests}
                disabled={!assigneeId || sending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send Requests'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
