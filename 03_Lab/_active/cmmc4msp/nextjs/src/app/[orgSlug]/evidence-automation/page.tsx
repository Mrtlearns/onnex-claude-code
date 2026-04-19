'use client'
import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import {
  LinkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import {
  GET_ORG_BY_SLUG,
  // GET_AUTO_COVERAGE counts artifacts where source_type IN ('entra_id','okta','defender','crowdstrike','o365','splunk','harvester','interview')
  GET_AUTO_COVERAGE,
  GET_INTERVIEW_CONTROLS,
} from '@/graphql/queries'

interface EvidenceAutomationPageProps {
  params: { orgSlug: string }
}

// ── Coverage Widget ────────────────────────────────────────────────────────────

function CoverageWidget({ programId }: { programId: string }) {
  const { data, loading } = useQuery(GET_AUTO_COVERAGE, {
    variables: { programId },
    skip: !programId,
  })

  const total = data?.total?.aggregate?.count ?? 0
  const auto = data?.auto_satisfied?.aggregate?.count ?? 0
  const pct = total > 0 ? Math.round((auto / total) * 100) : 0

  if (loading) {
    return <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
  }

  return (
    <span className="text-2xl font-bold text-blue-700">
      {auto}/{total} &nbsp;
      <span className="text-base font-medium text-gray-500">({pct}%)</span>
    </span>
  )
}

// ── Interview controls (chat history > 2 messages) ────────────────────────────

function useInterviewControls(programId: string, orgSlug: string) {
  const { data, loading } = useQuery(GET_INTERVIEW_CONTROLS, {
    variables: { programId },
    skip: !programId,
  })

  if (loading || !data) return []

  // Group by program_control_id and count messages
  const counts = new Map<string, { count: number; pc: any }>()
  for (const msg of data.control_chat_messages || []) {
    const id = msg.program_control_id
    if (!counts.has(id)) {
      counts.set(id, { count: 0, pc: msg.program_control })
    }
    counts.get(id)!.count++
  }

  return Array.from(counts.entries())
    .filter(([, v]) => v.count > 2)
    .slice(0, 5)
    .map(([id, v]) => ({
      id,
      nistId: v.pc?.control_definition?.nist_id,
      text: v.pc?.control_definition?.requirement_text,
      href: `/${orgSlug}/controls/${id}`,
    }))
}

// ── Harvester Card ────────────────────────────────────────────────────────────

function HarvesterCard({ programId, accessToken }: { programId: string; accessToken: string }) {
  const API = process.env.NEXT_PUBLIC_API_URL || ''
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadToast, setUploadToast] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !programId) return
    setUploading(true)
    setUploadError(null)
    setUploadToast(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API}/api/artifacts/bulk-upload-zip?program_id=${programId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Upload failed')
      }
      const result = await res.json()
      const artifacts_created = result.artifacts_created ?? result.count ?? 0
      setUploadToast(`${artifacts_created} artifact${artifacts_created !== 1 ? 's' : ''} imported from ZIP`)
      setTimeout(() => setUploadToast(null), 5000)
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-9 h-9 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center">
          <ArrowDownTrayIcon className="w-5 h-5 text-amber-600" />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">Evidence Harvester Script</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Run our PowerShell or Bash script on a client system to automatically collect
            configuration screenshots, logs, and policy exports.
          </p>
          <p className="text-xs font-medium text-amber-700 mt-1.5">
            Covers ~35% of controls automatically
          </p>
        </div>
      </div>

      {/* Download buttons */}
      <div className="flex gap-2">
        <a
          href={`${API}/harvester/harvest_windows.ps1`}
          download="harvest_windows.ps1"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
          Download for Windows
        </a>
        <a
          href={`${API}/harvester/harvest_linux.sh`}
          download="harvest_linux.sh"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
          Download for Linux
        </a>
      </div>

      {/* ZIP upload */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-700 mb-2">Upload harvester ZIP output</p>
        <label
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-4 cursor-pointer transition-colors ${
            uploading
              ? 'border-blue-300 bg-blue-50 cursor-wait'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <ArrowDownTrayIcon className="w-5 h-5 text-gray-400 rotate-180" />
          <span className="text-xs text-gray-500">
            {uploading ? 'Uploading…' : 'Drop ZIP here or click to select'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            onChange={handleZipUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {uploadToast && (
          <p className="mt-2 text-xs text-green-700 font-medium">
            {uploadToast}
          </p>
        )}
        {uploadError && (
          <p className="mt-2 text-xs text-red-600">{uploadError}</p>
        )}
      </div>
    </div>
  )
}

// ── Interview Card ─────────────────────────────────────────────────────────────

function InterviewCard({
  programId,
  orgSlug,
}: {
  programId: string
  orgSlug: string
}) {
  const controls = useInterviewControls(programId, orgSlug)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-9 h-9 bg-purple-50 border border-purple-100 rounded-lg flex items-center justify-center">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">AI Interview to Evidence</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Chat with the Compliance Copilot on any control. When done, save the conversation
            as a structured evidence artifact — automatically queued for AI assessment.
          </p>
          <p className="text-xs font-medium text-purple-700 mt-1.5">
            Covers ~20% of controls via documented interviews
          </p>
        </div>
      </div>

      {controls.length > 0 ? (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-600 mb-2">
            Controls with active chat history:
          </p>
          <ul className="space-y-1.5">
            {controls.map((c) => (
              <li key={c.id}>
                <Link
                  href={c.href}
                  className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
                >
                  <span className="font-mono font-bold">{c.nistId}</span>
                  <span className="text-gray-500 truncate">{c.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Link
          href={`/${orgSlug}/controls`}
          className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Browse Controls
        </Link>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EvidenceAutomationPage({ params }: EvidenceAutomationPageProps) {
  const { orgSlug } = params
  const { data: session } = useSession()
  const user = session?.user as any
  const accessToken: string = user?.accessToken || ''

  const { data: orgData } = useQuery(GET_ORG_BY_SLUG, {
    variables: { slug: orgSlug },
  })
  const org = orgData?.orgs?.[0]
  const programId: string = org?.programs?.[0]?.id || ''

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Evidence Automation</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Accelerate evidence gathering with automation — connect tools, delegate work, and capture
          conversations as compliance artifacts.
        </p>
      </div>

      {/* Coverage summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Auto-Coverage
          </p>
          <CoverageWidget programId={programId} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Auto-satisfied
          </p>
          <span className="text-2xl font-bold text-green-700">—</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Requested today
          </p>
          <span className="text-2xl font-bold text-blue-700">—</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Pending assessment
          </p>
          <span className="text-2xl font-bold text-amber-700">—</span>
        </div>
      </div>

      {/* Feature cards — 2×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Integrations */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-9 h-9 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-blue-600" />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Connect Integrations</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Connect Entra ID, Defender, Okta, CrowdStrike, M365, and Splunk to automatically
                pull configuration evidence — no manual uploads needed.
              </p>
              <p className="text-xs font-medium text-blue-700 mt-1.5">
                Covers ~40% of controls automatically
              </p>
            </div>
          </div>
          <Link
            href={`/${orgSlug}/integrations`}
            className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Go to Integrations
          </Link>
        </div>

        {/* Card 2: Request Evidence from Team */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-9 h-9 bg-green-50 border border-green-100 rounded-lg flex items-center justify-center">
              <PaperAirplaneIcon className="w-5 h-5 text-green-600" />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Request Evidence from Team</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Select controls from the Controls list and bulk-assign them to team members.
                They receive an email with instructions and upload directly here.
              </p>
              <p className="text-xs font-medium text-green-700 mt-1.5">
                Covers ~60% of controls via delegation
              </p>
            </div>
          </div>
          <Link
            href={`/${orgSlug}/controls`}
            className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
          >
            <PaperAirplaneIcon className="w-3.5 h-3.5" />
            Open Controls
          </Link>
        </div>

        {/* Card 3: AI Interview to Evidence */}
        <InterviewCard programId={programId} orgSlug={orgSlug} />

        {/* Card 4: Harvester */}
        <HarvesterCard programId={programId} accessToken={accessToken} />
      </div>
    </div>
  )
}
