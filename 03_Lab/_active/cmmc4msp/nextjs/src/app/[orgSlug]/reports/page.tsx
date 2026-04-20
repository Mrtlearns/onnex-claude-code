'use client'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_ORG_BY_SLUG } from '@/graphql/queries'
import { generateReport } from '@/lib/api'
import {
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  TableCellsIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'

interface ReportsPageProps {
  params: { orgSlug: string }
}

export default function ReportsPage({ params }: ReportsPageProps) {
  const { orgSlug } = params
  const [sspUrl, setSspUrl] = useState<string | null>(null)
  const [poamUrl, setPoamUrl] = useState<string | null>(null)
  const [sprsUrl, setSprsUrl] = useState<string | null>(null)
  const [auditUrl, setAuditUrl] = useState<string | null>(null)
  const [sspGenerating, setSspGenerating] = useState(false)
  const [poamGenerating, setPoamGenerating] = useState(false)
  const [sprsGenerating, setSprsGenerating] = useState(false)
  const [auditGenerating, setAuditGenerating] = useState(false)
  const [sspError, setSspError] = useState<string | null>(null)
  const [poamError, setPoamError] = useState<string | null>(null)
  const [sprsError, setSprsError] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)

  const { data: orgData } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })

  const org = orgData?.orgs?.[0]
  const programId = org?.programs?.[0]?.id

  const handleGenerate = async (type: 'ssp' | 'poam' | 'sprs-sheet' | 'audit-package') => {
    if (!programId) return

    const stateMap = {
      'ssp':           { setGenerating: setSspGenerating,   setUrl: setSspUrl,   setError: setSspError },
      'poam':          { setGenerating: setPoamGenerating,  setUrl: setPoamUrl,  setError: setPoamError },
      'sprs-sheet':    { setGenerating: setSprsGenerating,  setUrl: setSprsUrl,  setError: setSprsError },
      'audit-package': { setGenerating: setAuditGenerating, setUrl: setAuditUrl, setError: setAuditError },
    }
    const { setGenerating, setUrl, setError } = stateMap[type]

    setGenerating(true)
    setError(null)
    try {
      const result = await generateReport(programId, type)
      setUrl(result.download_url)
    } catch (err: any) {
      setError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const reportCards = [
    {
      type: 'ssp' as const,
      title: 'System Security Plan (SSP)',
      badge: null as string | null,
      description:
        'Full SSP document including system description, boundary, CUI data flows, and implementation status for all 110 NIST SP 800-171 controls.',
      icon: DocumentTextIcon,
      generating: sspGenerating,
      url: sspUrl,
      error: sspError,
    },
    {
      type: 'poam' as const,
      title: 'Plan of Action & Milestones (POA&M)',
      badge: null as string | null,
      description:
        'Structured POA&M listing all non-compliant controls, assigned owners, target remediation dates, and resource estimates.',
      icon: ClipboardDocumentListIcon,
      generating: poamGenerating,
      url: poamUrl,
      error: poamError,
    },
    {
      type: 'sprs-sheet' as const,
      title: 'SPRS Score Summary Sheet',
      badge: 'Excel · PIEE Ready',
      description:
        'Pre-filled Excel workbook with SPRS score breakdown by domain and control. Contains step-by-step PIEE submission instructions to report your self-assessed score to DoD.',
      icon: TableCellsIcon,
      generating: sprsGenerating,
      url: sprsUrl,
      error: sprsError,
    },
    {
      type: 'audit-package' as const,
      title: 'Full C3PAO Audit Package',
      badge: 'ZIP · All Evidence',
      description:
        'Bundled ZIP containing SSP, POA&M, SPRS worksheet, manifest CSV, and all uploaded evidence files organized by control domain. Hand this to your C3PAO assessor.',
      icon: ArchiveBoxArrowDownIcon,
      generating: auditGenerating,
      url: auditUrl,
      error: auditError,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Generate CMMC-required documents for {org?.name || 'this organization'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {reportCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.type} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-gray-900">{card.title}</h2>
                    {card.badge && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{card.description}</p>
                </div>
              </div>

              {card.error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {card.error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleGenerate(card.type)}
                  disabled={card.generating || !programId}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {card.generating ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <DocumentArrowDownIcon className="w-4 h-4" />
                      {card.url ? 'Regenerate' : 'Generate'}
                    </>
                  )}
                </button>
                {card.url && (
                  <a
                    href={card.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    Download
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Note:</strong> Generated documents reflect the current state of your compliance
        program. Regenerate after updating control statuses or milestone data. Documents are stored
        temporarily — download and retain copies in your document management system.
      </div>
    </div>
  )
}
