'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_CONTROL_DETAIL } from '@/graphql/queries'
import { UPDATE_CONTROL_STATUS, UPDATE_CONTROL_NOTES } from '@/graphql/mutations'
import { ControlStatusBadge } from '@/components/ControlStatusBadge'
import { ArtifactUploader } from '@/components/ArtifactUploader'
import { AlsoSatisfiesList } from '@/components/AlsoSatisfiesList'
import { ControlStatus } from '@/lib/types'
import { CONTROL_STATUS_CONFIG } from '@/lib/constants'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useSession } from 'next-auth/react'

function parseProofGuidance(text: string): { label: string; items: string[] }[] {
  const sections: { label: string; items: string[] }[] = []
  const pattern = /\b(EXAMINE|INTERVIEW|TEST)\s*:/g
  const labels = [...text.matchAll(pattern)].map((m) => ({ label: m[1], index: m.index! }))
  labels.forEach(({ label, index }, i) => {
    const end = i + 1 < labels.length ? labels[i + 1].index : text.length
    const raw = text.slice(index + label.length + 1, end).trim()
    const inner = raw.replace(/^\[SELECT FROM:\s*/i, '').replace(/\]\.?\s*$/, '').trim()
    const items = inner.split(';').map((s) => s.trim()).filter(Boolean)
    sections.push({ label, items })
  })
  return sections.length ? sections : [{ label: 'GUIDANCE', items: [text] }]
}

interface ControlDetailProps {
  params: { orgSlug: string; id: string }
}

const VERDICT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pass: { label: 'Pass', color: 'text-green-700 bg-green-50 border-green-200', icon: CheckCircleIcon },
  partial: { label: 'Partial', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: ClockIcon },
  fail: { label: 'Fail', color: 'text-red-700 bg-red-50 border-red-200', icon: XCircleIcon },
  not_applicable: { label: 'N/A', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: ClockIcon },
}

export default function ControlDetailPage({ params }: ControlDetailProps) {
  const { id, orgSlug } = params
  const { data: session } = useSession()
  const user = session?.user as any
  const canEdit = user?.role === 'msp_admin' || user?.role === 'client_admin'

  const [proofExpanded, setProofExpanded] = useState(false)
  const [statusDraft, setStatusDraft] = useState<string>('')
  const [notesDraft, setNotesDraft] = useState<string>('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [statusSaved, setStatusSaved] = useState(false)

  const { data, loading, refetch } = useQuery(GET_CONTROL_DETAIL, {
    variables: { controlId: id },
    onCompleted: (d) => {
      const pc = d?.program_controls_by_pk
      if (pc) {
        setStatusDraft(pc.status)
        setNotesDraft(pc.implementation_notes || '')
      }
    },
  })

  const [updateStatus] = useMutation(UPDATE_CONTROL_STATUS)
  const [updateNotes] = useMutation(UPDATE_CONTROL_NOTES)

  const pc = data?.program_controls_by_pk
  const def = pc?.control_definition

  const makeApplyHandler = (artifactId: string) => async (controlDefinitionId: string) => {
    const token = (session?.user as any)?.accessToken
    const API = process.env.NEXT_PUBLIC_API_URL || ''
    await fetch(`${API}/api/artifacts/${artifactId}/apply-to-control`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        control_definition_id: controlDefinitionId,
        program_id: pc?.program_id || '',
      }),
    })
  }

  const handleStatusSave = async () => {
    await updateStatus({ variables: { id, status: statusDraft, notes: notesDraft } })
    setStatusSaved(true)
    setTimeout(() => setStatusSaved(false), 2000)
    refetch()
  }

  const handleNotesSave = async () => {
    await updateNotes({ variables: { id, notes: notesDraft } })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-32" />
        <div className="h-16 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!pc) {
    return <div className="text-gray-400 py-8 text-center">Control not found</div>
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-lg font-bold text-blue-700">{def?.nist_id}</span>
            <span className="text-gray-400">·</span>
            <span className="text-sm text-gray-500 font-mono">{def?.cmmc_id}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
              {def?.family_abbrev}
            </span>
            <span className="text-xs text-gray-400">Phase {def?.far_above_phase}</span>
          </div>
          <h1 className="text-base font-semibold text-gray-800">{def?.family}</h1>
        </div>
        <ControlStatusBadge status={pc.status as ControlStatus} />
      </div>

      {/* Requirement Text */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Requirement</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{def?.requirement_text}</p>
        {def?.assessment_objective && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Assessment Objective
            </h3>
            <p className="text-sm text-gray-600">{def.assessment_objective}</p>
          </div>
        )}
      </div>

      {/* Proof Guidance (expandable) */}
      {def?.acceptable_proof_guidance && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            onClick={() => setProofExpanded((v) => !v)}
          >
            Acceptable Proof Guidance
            {proofExpanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
          {proofExpanded && (
            <div className="px-5 pb-4 space-y-4">
              {parseProofGuidance(def.acceptable_proof_guidance).map(({ label, items }) => (
                <div key={label}>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">{label}</p>
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-blue-900">
                        <span className="mt-0.5 shrink-0 text-blue-400">›</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Update */}
      {canEdit && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Update Implementation Status</h2>
          <select
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CONTROL_STATUS_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>
                {cfg.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleStatusSave}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {statusSaved ? 'Saved!' : 'Save Status'}
          </button>
        </div>
      )}

      {/* Implementation Notes */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Implementation Notes</h2>
        {canEdit ? (
          <>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 h-28"
              placeholder="Document how this control is implemented..."
            />
            <button
              onClick={handleNotesSave}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              {notesSaved ? 'Saved!' : 'Save Notes'}
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            {pc.implementation_notes || <span className="text-gray-400">No notes yet</span>}
          </p>
        )}
      </div>

      {/* Artifacts */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Evidence Artifacts</h2>
        {(pc.artifacts || []).length === 0 ? (
          <p className="text-sm text-gray-400">No artifacts uploaded yet</p>
        ) : (
          <div className="space-y-3">
            {pc.artifacts!.map((artifact: any) => {
              const assessment = artifact.assessments?.[0]
              const vc = assessment ? VERDICT_CONFIG[assessment.verdict] : null
              const VerdictIcon = vc?.icon

              return (
                <div
                  key={artifact.id}
                  className="border border-gray-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{artifact.file_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Uploaded {new Date(artifact.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium border ${
                        artifact.assessment_status === 'assessed'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : artifact.assessment_status === 'processing'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : artifact.assessment_status === 'failed'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {artifact.assessment_status}
                    </span>
                  </div>
                  {/* RAG cross-control suggestions */}
                  {artifact.assessment_status === 'assessed' && (
                    <AlsoSatisfiesList
                      artifactId={artifact.id}
                      orgSlug={orgSlug}
                      programId={pc.program_id || ''}
                      onApply={canEdit ? makeApplyHandler(artifact.id) : undefined}
                    />
                  )}

                  {assessment && (
                    <div className={`p-3 rounded border ${vc?.color}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {VerdictIcon && <VerdictIcon className="w-4 h-4" />}
                        <span className="text-xs font-bold uppercase">{vc?.label}</span>
                        {assessment.confidence && (
                          <span className="text-xs opacity-70">
                            {Math.round(assessment.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      {assessment.rationale && (
                        <p className="text-xs mt-1">{assessment.rationale}</p>
                      )}
                      {assessment.gaps && assessment.gaps.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium">Gaps identified:</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {assessment.gaps.map((gap: string, i: number) => (
                              <li key={i} className="text-xs">
                                {gap}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Upload new artifact */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
            Upload New Evidence
          </h3>
          <ArtifactUploader
            programControlId={pc.id}
            onUploadComplete={() => refetch()}
          />
        </div>
      </div>
    </div>
  )
}
