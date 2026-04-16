/* eslint-disable react-refresh/only-export-components */
/**
 * PipelineStatusPanel — step timeline Card for AnalysisPage
 *
 * Exports:
 *  - All shared types and constants (StepStatus, StepProgress, LogEntry, StepDef, DemoEvent)
 *  - PIPELINE_STEPS, DEMO_SEQUENCE, CATEGORY_STYLE
 *  - Helper fns: buildProgressMap, overallStatus
 *  - Sub-components: StatusDot, ConnectorLine, DirectionArrow, StepStatusBadge
 *  - Default export: PipelineStatusPanel (the left-column timeline Card)
 */
import {
  Mail, Shield, MessageSquare, ShieldCheck, Lock,
  KeyRound, Search, Cpu, BrainCircuit, Layers, FileCheck,
  CheckCircle2, XCircle, Loader2, Minus,
  ArrowUp, ArrowDown, Clock, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ── Types ──────────────────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped'

export interface StepProgress {
  key: string
  status: StepStatus
  log: string[]
  detail?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
}

export interface LogEntry {
  timestamp: string
  stepKey: string
  stepLabel: string
  message: string
  status: StepStatus
}

export type StepCategory = 'intake' | 'security' | 'ai' | 'system' | 'output'

export interface StepDef {
  key: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: StepCategory
}

// ── Category style map ─────────────────────────────────────────────────────

export const CATEGORY_STYLE: Record<StepCategory, { bg: string; text: string; label: string }> = {
  intake:   { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-600 dark:text-blue-400',     label: 'Intake'   },
  security: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400', label: 'Security' },
  ai:       { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400', label: 'AI / LLM' },
  system:   { bg: 'bg-gray-100 dark:bg-gray-800',        text: 'text-gray-500 dark:text-gray-400',     label: 'System'   },
  output:   { bg: 'bg-green-100 dark:bg-green-900/40',   text: 'text-green-600 dark:text-green-400',   label: 'Output'   },
}

// ── Pipeline step definitions ──────────────────────────────────────────────

export const PIPELINE_STEPS: StepDef[] = [
  { key: 'intake',          label: 'Message Received',          description: 'Intake session created',                      icon: Mail,          category: 'intake'   },
  { key: 'email_sanitize',  label: 'Email Sanitization',        description: 'Tokenizing PII in email body',                icon: Shield,        category: 'security' },
  { key: 'email_llm',       label: 'Email LLM Analysis',        description: 'Extracting quote parameters via AI',          icon: MessageSquare, category: 'ai'       },
  { key: 'comply_classify', label: 'Compliance Classification', description: 'ITAR / EAR document screening',               icon: ShieldCheck,   category: 'security' },
  { key: 'compliance_gate', label: 'Compliance Gate',           description: 'Routing enforcement decision',                icon: Lock,          category: 'security' },
  { key: 'sanitize_pii',    label: 'PII Sanitization',          description: 'Tokenizing entities in attachments',          icon: KeyRound,      category: 'security' },
  { key: 'type_detection',  label: 'Inspection Type Detection', description: 'Identifying UT / RT / MT / PT / ET / VT',     icon: Search,        category: 'system'   },
  { key: 'preprocessor',    label: 'Pre-processor',             description: 'Running type-specific preparation steps',     icon: Cpu,           category: 'system'   },
  { key: 'llm_analysis',    label: 'LLM Analysis',              description: 'AI analysis via Anthropic or Ollama (local)', icon: BrainCircuit,  category: 'ai'       },
  { key: 'assemble',        label: 'Assemble Results',          description: 'Combining email + attachment outputs',        icon: Layers,        category: 'system'   },
  { key: 'quote_created',   label: 'Quote Created',             description: 'Final quote submitted to UT engine',          icon: FileCheck,     category: 'output'   },
]

// ── Helpers ────────────────────────────────────────────────────────────────

export function buildProgressMap(stepProgress: StepProgress[]): Map<string, StepProgress> {
  const map = new Map<string, StepProgress>()
  for (const s of stepProgress) map.set(s.key, s)
  return map
}

export function overallStatus(
  stepProgress: StepProgress[],
  sessionStatus: string,
): 'idle' | 'processing' | 'completed' | 'failed' | 'stalled' {
  if (sessionStatus === 'stalled')    return 'stalled'
  if (sessionStatus === 'completed') return 'completed'
  if (sessionStatus === 'failed')    return 'failed'
  if (sessionStatus === 'processing') return 'processing'
  if (stepProgress.some(s => s.status === 'failed')) return 'failed'
  if (stepProgress.some(s => s.status === 'processing')) return 'processing'
  if (stepProgress.length > 0) return 'processing'
  return 'idle'
}

// ── StatusDot ──────────────────────────────────────────────────────────────

export function StatusDot({ status }: { status: StepStatus }) {
  if (status === 'success') {
    return (
      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-green-200 dark:ring-green-900/60">
        <CheckCircle2 className="h-4 w-4 text-white" />
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-red-200 dark:ring-red-900/60">
        <XCircle className="h-4 w-4 text-white" />
      </div>
    )
  }
  if (status === 'processing') {
    return (
      <div className="relative w-8 h-8 shrink-0">
        <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-50" />
        <div className="relative w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-sm ring-2 ring-green-300 dark:ring-green-700">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        </div>
      </div>
    )
  }
  if (status === 'skipped') {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center shrink-0">
        <Minus className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700 shrink-0" />
  )
}

// ── ConnectorLine ──────────────────────────────────────────────────────────

export function ConnectorLine({ fromStatus }: { fromStatus: StepStatus }) {
  const filled = fromStatus === 'success' || fromStatus === 'skipped'
  return (
    <div className="flex justify-center w-8">
      <div className={`w-0.5 h-5 transition-colors duration-700 ${filled ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
    </div>
  )
}

// ── DirectionArrow ─────────────────────────────────────────────────────────

export function DirectionArrow({ status }: { status: StepStatus }) {
  if (status === 'processing') {
    return (
      <span title="Sending request…" className="inline-flex items-center gap-0.5 text-blue-500">
        <ArrowUp className="h-3.5 w-3.5 animate-bounce" />
        <span className="text-[10px] font-semibold tracking-tight leading-none">SENT</span>
      </span>
    )
  }
  if (status === 'success') {
    return (
      <span title="Response received" className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
        <ArrowDown className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold tracking-tight leading-none">RECV</span>
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span title="Request failed" className="inline-flex items-center gap-0.5 text-red-500">
        <ArrowUp className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold tracking-tight leading-none">ERR</span>
      </span>
    )
  }
  return <span className="inline-flex w-[42px]" />
}

// ── StepStatusBadge ────────────────────────────────────────────────────────

export function StepStatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, string> = {
    success:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    processing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-pulse',
    skipped:    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    pending:    'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
  }
  const labels: Record<StepStatus, string> = {
    success: 'Done', failed: 'Failed', processing: 'Running', skipped: 'Skipped', pending: 'Pending',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  )
}

// ── PipelineStatusPanel ────────────────────────────────────────────────────

interface PipelineStatusPanelProps {
  progressMap: Map<string, StepProgress>
  selectedStep: string | null
  onSelectStep: (key: string | null) => void
}

export default function PipelineStatusPanel({ progressMap, selectedStep, onSelectStep }: PipelineStatusPanelProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Pipeline Steps
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-0">
          {PIPELINE_STEPS.map((step, idx) => {
            const sp = progressMap.get(step.key)
            const stepStatus: StepStatus = sp?.status ?? 'pending'
            const isSelected = selectedStep === step.key
            const isLast = idx === PIPELINE_STEPS.length - 1
            const Icon = step.icon
            const catStyle = CATEGORY_STYLE[step.category]

            return (
              <div key={step.key}>
                <div
                  className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => onSelectStep(step.key === selectedStep ? null : step.key)}
                >
                  <StatusDot status={stepStatus} />

                  <div
                    title={catStyle.label}
                    className={`shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center ${catStyle.bg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${catStyle.text}`} />
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm font-medium truncate ${
                        stepStatus === 'pending'
                          ? 'text-muted-foreground'
                          : stepStatus === 'skipped'
                          ? 'text-muted-foreground/60 line-through'
                          : 'text-foreground'
                      }`}>
                        {step.label}
                      </span>

                      <DirectionArrow status={stepStatus} />
                      <StepStatusBadge status={stepStatus} />
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      <span className={`font-semibold mr-1 ${catStyle.text}`}>[{catStyle.label}]</span>
                      {step.description}
                    </p>

                    {sp?.completedAt && sp?.startedAt && sp.status === 'success' && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {((new Date(sp.completedAt).getTime() - new Date(sp.startedAt).getTime()) / 1000).toFixed(1)}s
                      </p>
                    )}

                    {isSelected && sp?.detail && (
                      <div className="mt-2 text-xs font-mono bg-muted/50 rounded p-2 space-y-0.5">
                        {Object.entries(sp.detail).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-muted-foreground">{k}:</span>
                            <span>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {!isLast && <ConnectorLine fromStatus={stepStatus} />}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
