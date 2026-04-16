import { useEffect, useRef, useState } from 'react'
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  AlertTriangle, Clock, CheckCircle2, Loader2,
  FileText, Lock, Globe, Server,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ── Types ───────────────────────────────────────────────────────────────────

type Classification = 'CLEAN' | 'EAR_LOW' | 'EAR_HIGH' | 'ITAR' | 'NEEDS_REVIEW' | 'REJECTED'
type LLMRouting     = 'CLOUD_OK' | 'LOCAL_ONLY' | 'HOLD'
type IntakeStatus   = 'processing' | 'completed' | 'failed' | 'hold'

interface AttachmentClassification {
  id:              string
  filename:        string
  classification:  Classification
  llm_routing:     LLMRouting
  risk_score:      number
  drawing_number?: string
}

interface StatusPayload {
  status:           IntakeStatus
  strictestRouting: LLMRouting | null
  quoteId:          string | null
  classifications:  AttachmentClassification[]
}

interface Props {
  intakeId: string | null
}

// ── Classification badge config ─────────────────────────────────────────────

const CLASSIFICATION_CONFIG: Record<Classification, {
  label: string
  bgClass: string
  textClass: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  CLEAN: {
    label: 'Clean',
    bgClass: 'bg-green-100 dark:bg-green-900/40',
    textClass: 'text-green-700 dark:text-green-300',
    icon: ShieldCheck,
  },
  EAR_LOW: {
    label: 'EAR Low',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/40',
    textClass: 'text-yellow-700 dark:text-yellow-300',
    icon: Shield,
  },
  EAR_HIGH: {
    label: 'EAR High',
    bgClass: 'bg-orange-100 dark:bg-orange-900/40',
    textClass: 'text-orange-700 dark:text-orange-300',
    icon: ShieldAlert,
  },
  ITAR: {
    label: 'ITAR',
    bgClass: 'bg-red-100 dark:bg-red-900/40',
    textClass: 'text-red-700 dark:text-red-300',
    icon: ShieldX,
  },
  NEEDS_REVIEW: {
    label: 'Needs Review',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-600 dark:text-slate-400',
    icon: AlertTriangle,
  },
  REJECTED: {
    label: 'Rejected',
    bgClass: 'bg-red-200 dark:bg-red-900/60',
    textClass: 'text-red-800 dark:text-red-200',
    icon: ShieldX,
  },
}

// ── Routing badge config ────────────────────────────────────────────────────

const ROUTING_CONFIG: Record<LLMRouting, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  className: string
}> = {
  CLOUD_OK: {
    label: 'Cloud (Anthropic)',
    icon: Globe,
    className: 'text-blue-600 dark:text-blue-400',
  },
  LOCAL_ONLY: {
    label: 'Local (Ollama)',
    icon: Server,
    className: 'text-violet-600 dark:text-violet-400',
  },
  HOLD: {
    label: 'Human Review Required',
    icon: Lock,
    className: 'text-red-600 dark:text-red-400',
  },
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ClassificationBadge({ classification }: { classification: Classification }) {
  const cfg = CLASSIFICATION_CONFIG[classification]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bgClass} ${cfg.textClass}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function RoutingBadge({ routing }: { routing: LLMRouting }) {
  const cfg = ROUTING_CONFIG[routing]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function CompliancePanel({ intakeId }: Props) {
  const [data, setData]         = useState<StatusPayload | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll status every 2s while processing
  useEffect(() => {
    if (!intakeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
      setData(null)
      setError(null)
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/ut/integrations/pipeline/status/${intakeId}`)
        if (!res.ok) {
          setError(`Status check failed (${res.status})`)
          stopPolling()
          return
        }
        const payload: StatusPayload = await res.json()
        setData(payload)
        if (payload.status !== 'processing') {
          stopPolling()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error')
        stopPolling()
      }
    }

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    // Immediate first poll
    poll()
    pollRef.current = setInterval(poll, 2000)

    return () => stopPolling()
  }, [intakeId])

  // ── Empty state ────────────────────────────────────────────────────────
  if (!intakeId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Compliance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <Shield className="h-8 w-8 opacity-25" />
            <p className="text-sm">Upload a .msg file to run compliance analysis</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Processing spinner ────────────────────────────────────────────────
  if (!data || data.status === 'processing') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            Compliance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">Analyzing attachments…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Checking ITAR/EAR classification and routing to appropriate LLM
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <ShieldX className="h-4 w-4" />
            Compliance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  // ── Strictest routing summary ─────────────────────────────────────────
  const strictest = data.strictestRouting ?? 'CLOUD_OK'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Compliance Analysis
          </span>
          <span className="text-xs font-normal">
            {data.status === 'completed' && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete
              </span>
            )}
            {data.status === 'hold' && (
              <span className="flex items-center gap-1 text-amber-500">
                <Clock className="h-3.5 w-3.5" />
                Pending Review
              </span>
            )}
            {data.status === 'failed' && (
              <span className="flex items-center gap-1 text-destructive">
                <ShieldX className="h-3.5 w-3.5" />
                Failed
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Overall routing decision ── */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pipeline Routing Decision
          </p>
          <div className="flex items-center gap-2">
            <RoutingBadge routing={strictest} />
            {strictest === 'HOLD' && (
              <span className="text-xs text-muted-foreground">
                — one or more documents require human review before LLM processing
              </span>
            )}
            {strictest === 'LOCAL_ONLY' && (
              <span className="text-xs text-muted-foreground">
                — ITAR/EAR-controlled content routed to Ollama (RTX 3090)
              </span>
            )}
            {strictest === 'CLOUD_OK' && (
              <span className="text-xs text-muted-foreground">
                — no controlled content detected, routed to Anthropic
              </span>
            )}
          </div>
        </div>

        {/* ── Per-attachment classification ── */}
        {data.classifications.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Attachments ({data.classifications.length})
            </p>
            <div className="space-y-1.5">
              {data.classifications.map(att => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-xs font-mono truncate min-w-0">{att.filename}</span>
                  {att.drawing_number && (
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      DWG {att.drawing_number}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    score {att.risk_score}
                  </span>
                  <ClassificationBadge classification={att.classification} />
                </div>
              ))}
            </div>
          </div>
        )}

        {data.classifications.length === 0 && data.status === 'completed' && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No attachments to classify (email body only)
          </p>
        )}

        {/* ── Quote generated ── */}
        {data.quoteId && (
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 pt-1">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Quote generated from extracted parameters
          </div>
        )}
      </CardContent>
    </Card>
  )
}
