'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_ORG_BY_SLUG, GET_POAM_ITEMS } from '@/graphql/queries'
import { UPDATE_MILESTONE } from '@/graphql/mutations'
import { ControlStatusBadge } from '@/components/ControlStatusBadge'
import { ControlStatus } from '@/lib/types'
import { generateReport } from '@/lib/api'
import { DocumentArrowDownIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline'

interface PoamPageProps {
  params: { orgSlug: string }
}

export default function PoamPage({ params }: PoamPageProps) {
  const { orgSlug } = params
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null)
  const [milestoneEdits, setMilestoneEdits] = useState<Record<string, any>>({})

  const { data: orgData } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const programId = orgData?.orgs?.[0]?.programs?.[0]?.id

  const { data, loading, refetch } = useQuery(GET_POAM_ITEMS, {
    variables: { programId },
    skip: !programId,
  })

  const [updateMilestone] = useMutation(UPDATE_MILESTONE)

  const items = data?.program_controls || []

  const handleGeneratePoam = async () => {
    if (!programId) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const result = await generateReport(programId, 'poam')
      setDownloadUrl(result.download_url)
    } catch (err: any) {
      setGenerateError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const startEditMilestone = (milestoneId: string, current: any) => {
    setEditingMilestone(milestoneId)
    setMilestoneEdits({
      [milestoneId]: {
        responsible_org: current?.responsible_org || '',
        remediation_plan: current?.remediation_plan || '',
        current_milestone_date: current?.current_milestone_date || '',
      },
    })
  }

  const saveMilestone = async (milestoneId: string) => {
    const edits = milestoneEdits[milestoneId]
    await updateMilestone({
      variables: {
        id: milestoneId,
        milestone_date: edits.current_milestone_date || null,
        responsible_org: edits.responsible_org || null,
        remediation_plan: edits.remediation_plan || null,
      },
    })
    setEditingMilestone(null)
    refetch()
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plan of Action & Milestones</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} open items</p>
        </div>
        <div className="flex items-center gap-3">
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              Download POA&M
            </a>
          )}
          <button
            onClick={handleGeneratePoam}
            disabled={generating || !programId}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            {generating ? 'Generating…' : 'Generate POA&M PDF'}
          </button>
        </div>
      </div>

      {generateError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {generateError}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-400">No open POA&M items — all applicable controls are fully implemented!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((pc: any) => {
            const def = pc.control_definition
            const milestone = pc.milestones?.[0]
            const isEditing = editingMilestone === milestone?.id
            const edits = milestoneEdits[milestone?.id] || {}

            return (
              <div key={pc.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-blue-700">{def?.nist_id}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {def?.family_abbrev}
                      </span>
                      <span className="text-xs text-gray-400">Phase {def?.far_above_phase}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{def?.requirement_text}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ControlStatusBadge status={pc.status as ControlStatus} size="sm" />
                    {def?.dod_score_value !== undefined && (
                      <span className="text-xs font-medium text-red-600">
                        -{def.dod_score_value} pts
                      </span>
                    )}
                  </div>
                </div>

                {/* Milestone */}
                {milestone && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Responsible Org</label>
                            <input
                              type="text"
                              value={edits.responsible_org || ''}
                              onChange={(e) =>
                                setMilestoneEdits((m) => ({
                                  ...m,
                                  [milestone.id]: { ...edits, responsible_org: e.target.value },
                                }))
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              placeholder="Team or vendor name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Target Date</label>
                            <input
                              type="date"
                              value={edits.current_milestone_date || ''}
                              onChange={(e) =>
                                setMilestoneEdits((m) => ({
                                  ...m,
                                  [milestone.id]: {
                                    ...edits,
                                    current_milestone_date: e.target.value,
                                  },
                                }))
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Remediation Plan
                          </label>
                          <textarea
                            value={edits.remediation_plan || ''}
                            onChange={(e) =>
                              setMilestoneEdits((m) => ({
                                ...m,
                                [milestone.id]: { ...edits, remediation_plan: e.target.value },
                              }))
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm h-16"
                            placeholder="Describe the remediation steps..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveMilestone(milestone.id)}
                            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
                          >
                            <CheckIcon className="w-3 h-3" /> Save
                          </button>
                          <button
                            onClick={() => setEditingMilestone(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="grid grid-cols-3 gap-4 flex-1 text-xs">
                          <div>
                            <p className="text-gray-400">Responsible</p>
                            <p className="text-gray-700 font-medium">
                              {milestone.responsible_org || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Target Date</p>
                            <p className="text-gray-700 font-medium">
                              {milestone.current_milestone_date
                                ? new Date(milestone.current_milestone_date).toLocaleDateString()
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Plan</p>
                            <p className="text-gray-700 line-clamp-2">
                              {milestone.remediation_plan || '—'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => startEditMilestone(milestone.id, milestone)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          <PencilIcon className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
