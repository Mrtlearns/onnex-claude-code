/**
 * AnalysisPage — NDT Pipeline Analysis Progress View
 *
 * Accessible at: /analysis/:intakeId
 * Special demo mode: /analysis/demo  (simulates a full pipeline run without real data)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { integrationsApi } from '@/lib/integrationsApi'
import {
  ArrowLeft, Loader2, Activity, ChevronRight, ScrollText, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import PipelineStatusPanel, {
  type StepProgress,
  type LogEntry,
  PIPELINE_STEPS,
  buildProgressMap,
  overallStatus,
} from './PipelineStatusPanel'
import ExecutionLogPanel, { PipelineResultCards } from './ExecutionLogPanel'

export { PIPELINE_STEPS }

// ── Demo simulation sequence ────────────────────────────────────────────────
interface DemoEvent {
  delayMs: number
  stepKey: string
  status: StepProgress['status']
  log: string
  detail?: Record<string, unknown>
}

const DEMO_SEQUENCE: DemoEvent[] = [
  { delayMs: 300,  stepKey: 'intake',          status: 'success',    log: 'Intake session created  •  intakeId: demo-0001-a94f2b8c' },
  { delayMs: 400,  stepKey: 'email_sanitize',  status: 'processing', log: 'Starting PII sanitization on email body...' },
  { delayMs: 1200, stepKey: 'email_sanitize',  status: 'success',    log: 'Tokenized 3 entities: COMPANY__A94F, EMAIL__C3D1, PARTNUM__8E2B' },
  { delayMs: 300,  stepKey: 'email_llm',       status: 'processing', log: 'Sending sanitized email to Anthropic claude-haiku-4-5...' },
  { delayMs: 2700, stepKey: 'email_llm',       status: 'success',    log: 'Extracted: customerName=COMPANY__A94F  •  inspectionType=UT  •  qty=100 flat bars', detail: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', tokens: 412 } },
  { delayMs: 400,  stepKey: 'comply_classify', status: 'processing', log: 'Scanning "flat_bar_drawing.pdf" for ITAR / EAR keywords...' },
  { delayMs: 1500, stepKey: 'comply_classify', status: 'success',    log: 'Classification: CLEAN  •  risk_score: 2  •  routing: CLOUD_OK', detail: { classification: 'CLEAN', riskScore: 2, routing: 'CLOUD_OK' } },
  { delayMs: 200,  stepKey: 'compliance_gate', status: 'success',    log: 'Gate passed  •  CLOUD_OK — cleared for cloud LLM' },
  { delayMs: 400,  stepKey: 'sanitize_pii',    status: 'processing', log: 'Tokenizing drawing number and CAGE code...' },
  { delayMs: 900,  stepKey: 'sanitize_pii',    status: 'success',    log: 'Tokenized 2 entities: DRAWING__K2D1, CAGECODE__F4A9  •  vault entries stored' },
  { delayMs: 300,  stepKey: 'type_detection',  status: 'processing', log: 'Matching filename + email keywords against inspection types...' },
  { delayMs: 500,  stepKey: 'type_detection',  status: 'success',    log: 'Detected: UT (Ultrasonic Testing)  •  matched "ultrasonic" in email body', detail: { typeCode: 'UT', typeLabel: 'Ultrasonic Testing', matchedKeyword: 'ultrasonic' } },
  { delayMs: 300,  stepKey: 'preprocessor',    status: 'processing', log: 'Fetching UT inspection steps from DB...' },
  { delayMs: 500,  stepKey: 'preprocessor',    status: 'success',    log: 'Ran 3 preprocessor steps  •  Validate & Transform: OK  •  Route & Notify: OK  •  Post to ERP: skipped (no webhook)', detail: { stepsRun: 3, stepsFailed: 0, stepsSkipped: 1 } },
  { delayMs: 400,  stepKey: 'llm_analysis',    status: 'processing', log: 'Sending to Anthropic claude-haiku with UT-specific system prompt...' },
  { delayMs: 3200, stepKey: 'llm_analysis',    status: 'success',    log: 'Extracted: material=carbon steel  •  3.625″ × 11.625″ × 15.75″  •  qty=100  •  spec=ASTM A36', detail: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', tokens: 688 } },
  { delayMs: 400,  stepKey: 'assemble',        status: 'processing', log: 'Merging email analysis + attachment results...' },
  { delayMs: 600,  stepKey: 'assemble',        status: 'success',    log: 'Strictest routing: CLOUD_OK  •  1 attachment processed  •  Quote params assembled' },
  { delayMs: 400,  stepKey: 'quote_created',   status: 'processing', log: 'Submitting to UT quote engine...' },
  { delayMs: 800,  stepKey: 'quote_created',   status: 'success',    log: 'Quote created  •  quoteId: QT-2026-0042  •  estimated total: $2,340', detail: { quoteId: 'QT-2026-0042', total: 2340, customerName: 'COMPANY__A94F' } },
]

export default function AnalysisPage() {
  const { intakeId } = useParams<{ intakeId: string }>()
  const nav = useNavigate()
  const isDemo = intakeId === 'demo'

  const [stepProgress, setStepProgress] = useState<StepProgress[]>([])
  const [sessionStatus, setSessionStatus] = useState<string>('processing')
  const [quoteId, setQuoteId]             = useState<string | null>(null)
  const [logEntries, setLogEntries]       = useState<LogEntry[]>([])
  const [selectedStep, setSelectedStep]   = useState<string | null>(null)
  const logRef   = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // ── Scroll log to bottom on new entries ──────────────────────
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logEntries])

  // ── Append log entries from step updates ─────────────────────
  const applyStepUpdate = useCallback((
    stepKey: string,
    status: StepProgress['status'],
    logMsg: string,
    detail?: Record<string, unknown>,
  ) => {
    const stepDef = PIPELINE_STEPS.find(s => s.key === stepKey)
    const label   = stepDef?.label ?? stepKey
    const ts      = new Date().toISOString()

    setStepProgress(prev => {
      const next = [...prev]
      const idx  = next.findIndex(s => s.key === stepKey)
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          status,
          log: [...next[idx].log, logMsg],
          ...(detail !== undefined ? { detail } : {}),
          ...(status === 'processing' && !next[idx].startedAt ? { startedAt: ts } : {}),
          ...(status !== 'processing' ? { completedAt: ts } : {}),
        }
      } else {
        next.push({
          key: stepKey,
          status,
          log: [logMsg],
          ...(detail !== undefined ? { detail } : {}),
          startedAt: ts,
          ...(status !== 'processing' ? { completedAt: ts } : {}),
        })
      }
      return next
    })

    setLogEntries(prev => [...prev, { timestamp: ts, stepKey, stepLabel: label, message: logMsg, status }])

    if (status === 'success' || status === 'failed') {
      setSelectedStep(stepKey)
    }
  }, [])

  // ── Demo mode ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isDemo) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard: intentional reset on demo start
    setStepProgress([])
    setLogEntries([])
    setSessionStatus('processing')

    let accumulated = 0
    timerRef.current = DEMO_SEQUENCE.map(evt => {
      accumulated += evt.delayMs
      return setTimeout(() => {
        applyStepUpdate(evt.stepKey, evt.status, evt.log, evt.detail)
        if (evt.stepKey === 'quote_created' && evt.status === 'success') {
          setSessionStatus('completed')
          setQuoteId((evt.detail?.quoteId as string) ?? null)
        }
      }, accumulated)
    })

    return () => {
      timerRef.current.forEach(clearTimeout)
    }
  }, [isDemo, applyStepUpdate])

  // ── Real mode polling ─────────────────────────────────────────
  useEffect(() => {
    if (isDemo || !intakeId) return

    const poll = async () => {
      try {
        const data = await integrationsApi.getStatus(intakeId)

        const newStatus = data.status ?? 'processing'
        setSessionStatus(newStatus)
        setQuoteId(data.quoteId ?? null)

        const rawProgress: StepProgress[] = Array.isArray(data.stepProgress) ? data.stepProgress : []
        const effectiveProgress: StepProgress[] =
          rawProgress.length === 0 && (newStatus === 'processing' || newStatus === 'completed')
            ? [{ key: 'intake', status: 'success', log: [`Intake session created · intakeId: ${intakeId}`], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() }]
            : rawProgress

        if (effectiveProgress.length > 0) {
          setStepProgress(effectiveProgress)
          const newLog: LogEntry[] = []
          for (const sp of effectiveProgress) {
            const def = PIPELINE_STEPS.find(s => s.key === sp.key)
            const label = def?.label ?? sp.key
            for (const msg of sp.log ?? []) {
              newLog.push({
                timestamp: sp.startedAt ?? new Date().toISOString(),
                stepKey: sp.key,
                stepLabel: label,
                message: msg,
                status: sp.status,
              })
            }
          }
          setLogEntries(newLog)
        }
      } catch {
        // network error — keep polling
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [isDemo, intakeId])

  // ── Derived state ─────────────────────────────────────────────
  const progressMap = buildProgressMap(stepProgress)
  const status      = overallStatus(stepProgress, sessionStatus)
  const totalSteps  = PIPELINE_STEPS.length
  const doneCount   = stepProgress.filter(s => s.status === 'success' || s.status === 'skipped').length
  const progressPct = Math.round((doneCount / totalSteps) * 100)

  const statusColors: Record<string, string> = {
    idle:       'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    completed:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    failed:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    stalled:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }

  const statusLabels: Record<string, string> = {
    idle: 'Idle', processing: 'Processing', completed: 'Completed', failed: 'Failed', stalled: 'Stalled',
  }

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav('/')} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Pipeline Analysis</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDemo && (
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              Demo Mode
            </Badge>
          )}
          {!isDemo && intakeId && stepProgress.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => nav(`/audit/${intakeId}`)}>
              <ScrollText className="h-3.5 w-3.5" />
              Audit Log
            </Button>
          )}
          <Badge className={statusColors[status]}>
            {status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />}
            {status === 'stalled' && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
            {statusLabels[status]}
          </Badge>
        </div>
      </div>

      {/* ── Intake info bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground border rounded-lg px-4 py-2.5 bg-muted/30">
        <span className="font-medium text-foreground">
          {isDemo ? 'Demo Run' : `Intake ${intakeId?.slice(0, 8)}…`}
        </span>
        <span className="text-muted-foreground/50">|</span>
        <span>{doneCount} / {totalSteps} steps</span>
        <div className="flex-1 max-w-48">
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <span className="text-xs font-mono">{progressPct}%</span>
        {quoteId && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-green-600 dark:text-green-400 font-medium">Quote: {quoteId}</span>
          </>
        )}
      </div>

      {/* ── Main two-column layout ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <PipelineStatusPanel
          progressMap={progressMap}
          selectedStep={selectedStep}
          onSelectStep={setSelectedStep}
        />
        <ExecutionLogPanel
          logEntries={logEntries}
          selectedStep={selectedStep}
          logRef={logRef}
        />
      </div>

      <PipelineResultCards
        status={status}
        doneCount={doneCount}
        quoteId={quoteId}
        isDemo={isDemo}
        intakeId={intakeId}
        onNavigate={nav}
      />
    </div>
  )
}
