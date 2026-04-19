'use client'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_ORG_BY_SLUG, GET_PROGRAM_ARTIFACTS } from '@/graphql/queries'
import { DocumentTextIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline'

interface ArtifactsPageProps {
  params: { orgSlug: string }
}

const VERDICT_STYLES: Record<string, { label: string; cls: string }> = {
  met:             { label: 'Met',         cls: 'bg-green-100 text-green-800' },
  pass:            { label: 'Pass',        cls: 'bg-green-100 text-green-800' },
  partial:         { label: 'Partial',     cls: 'bg-yellow-100 text-yellow-800' },
  not_met:         { label: 'Not Met',     cls: 'bg-red-100 text-red-800' },
  fail:            { label: 'Fail',        cls: 'bg-red-100 text-red-800' },
  not_applicable:  { label: 'N/A',         cls: 'bg-gray-100 text-gray-600' },
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending:         { label: 'Pending',     cls: 'bg-gray-100 text-gray-600' },
  processing:      { label: 'Processing',  cls: 'bg-blue-100 text-blue-700' },
  assessed:        { label: 'Assessed',    cls: 'bg-green-100 text-green-800' },
  failed:          { label: 'Failed',      cls: 'bg-red-100 text-red-800' },
}

function confidenceBar(score: number | null | undefined) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-9 text-right">{pct}%</span>
    </div>
  )
}

export default function ArtifactsPage({ params }: ArtifactsPageProps) {
  const { orgSlug } = params
  const [search, setSearch] = useState('')
  const [verdictFilter, setVerdictFilter] = useState('')

  const { data: orgData } = useQuery(GET_ORG_BY_SLUG, { variables: { slug: orgSlug } })
  const programId = orgData?.orgs?.[0]?.programs?.[0]?.id

  const { data, loading } = useQuery(GET_PROGRAM_ARTIFACTS, {
    variables: { programId },
    skip: !programId,
  })

  const artifacts = data?.artifacts || []

  const filtered = artifacts.filter((a: any) => {
    const verdict = a.assessments?.[0]?.verdict || ''
    const matchesSearch =
      !search ||
      a.file_name.toLowerCase().includes(search.toLowerCase()) ||
      a.program_control?.control_definition?.nist_id?.includes(search)
    const matchesVerdict = !verdictFilter || verdict === verdictFilter
    return matchesSearch && matchesVerdict
  })

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-40" />
        <div className="h-10 bg-gray-200 rounded" />
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
          <h1 className="text-xl font-bold text-gray-900">Artifacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{artifacts.length} evidence file{artifacts.length !== 1 ? 's' : ''} uploaded</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by filename or control ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Verdicts</option>
          {Object.entries(VERDICT_STYLES).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <DocumentTextIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">{artifacts.length === 0 ? 'No artifacts uploaded yet.' : 'No results match your filters.'}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">File</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Control</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Verdict</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Confidence</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((artifact: any) => {
                const ctrl = artifact.program_control?.control_definition
                const assessment = artifact.assessments?.[0]
                const statusStyle = STATUS_STYLES[artifact.assessment_status] || { label: artifact.assessment_status, cls: 'bg-gray-100 text-gray-600' }
                const verdictStyle = assessment ? (VERDICT_STYLES[assessment.verdict] || { label: assessment.verdict, cls: 'bg-gray-100 text-gray-600' }) : null

                return (
                  <tr key={artifact.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate max-w-[200px]" title={artifact.file_name}>
                          {artifact.file_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 pl-6">{artifact.mime_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      {ctrl ? (
                        <div>
                          <span className="font-mono text-xs font-semibold text-blue-700">{ctrl.nist_id}</span>
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]" title={ctrl.requirement_text}>
                            {ctrl.requirement_text?.slice(0, 60)}{ctrl.requirement_text?.length > 60 ? '…' : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle.cls}`}>
                        {statusStyle.label}
                      </span>
                      {artifact.assessment_attempts > 1 && (
                        <div className="text-xs text-gray-400 mt-0.5">{artifact.assessment_attempts} attempts</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {verdictStyle ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${verdictStyle.cls}`}>
                          {verdictStyle.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {confidenceBar(assessment?.confidence)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(artifact.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
