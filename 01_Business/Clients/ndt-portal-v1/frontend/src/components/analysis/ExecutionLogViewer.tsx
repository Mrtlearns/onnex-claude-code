/**
 * ExecutionLogViewer — two-panel pipeline audit log viewer
 *
 * Usage as Dialog (QuotesApp):
 *   <ExecutionLogViewer intakeId={id} onClose={() => ...} embedded />
 *
 * Usage as standalone page (/audit/:intakeId):
 *   <ExecutionLogViewer />   ← reads intakeId from useParams
 *
 * Data source: GET /api/ut/integrations/pipeline/audit/:intakeId
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { integrationsApi } from '@/lib/integrationsApi'
import {
  ScrollText, RefreshCw, X, ArrowRight, ArrowLeft,
  Circle, AlertTriangle, ChevronDown, ChevronRight,
  ExternalLink, FileText, History,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PIPELINE_STEPS } from './AnalysisPage'

// ── Types ──────────────────────────────────────────────────────────────────

interface StepEvent {
  id: string
  intakeId: string
  stepKey: string
  eventType: 'start' | 'request_sent' | 'response_received' | 'complete' | 'error' | 'skip' | 'stalled'
  direction: 'out' | 'in' | 'internal' | null
  serviceName: string | null
  endpoint: string | null
  httpStatus: number | null
  latencyMs: number | null
  payload: Record<string, unknown> | null
  logMessage: string | null
  detail: Record<string, unknown> | null
  createdAt: string
}

interface AuditData {
  intake: {
    intakeId: string
    status: string
    msgFilename: string
    createdAt: string
    updatedAt: string
    stepProgress: unknown[]
  }
  events: StepEvent[]
  eventCount: number
}

// ── Step label map (built from shared PIPELINE_STEPS constant) ─────────────

const STEP_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PIPELINE_STEPS.map(s => [s.key, s.label]),
)
function stepLabel(key: string): string {
  return STEP_LABEL_MAP[key] ?? key
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function safeParseJson(val: unknown): Record<string, unknown> | null {
  if (val == null) return null
  if (typeof val === 'object') return val as Record<string, unknown>
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch { return null }
  }
  return null
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: 'out' | 'in' | 'internal' | null }) {
  if (direction === 'out') return <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
  if (direction === 'in')  return <ArrowLeft  className="h-3.5 w-3.5 text-green-500 shrink-0" />
  return <Circle className="h-3 w-3 text-gray-400 shrink-0" />
}

function EventPill({ eventType }: { eventType: StepEvent['eventType'] }) {
  const styles: Record<string, string> = {
    start:             'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    request_sent:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    response_received: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    complete:          'bg-green-500 text-white',
    error:             'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    skip:              'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    stalled:           'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }
  const labels: Record<string, string> = {
    start: 'start', request_sent: 'sent', response_received: 'recv',
    complete: 'done', error: 'error', skip: 'skip', stalled: 'stalled',
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${styles[eventType] ?? styles.start}`}>
      {labels[eventType] ?? eventType}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
    status === 'stalled'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
    status === 'failed'    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                             'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
  return <Badge className={cls}>{status}</Badge>
}

// ── Collapsible section ───────────────────────────────────────────────────

function CollapsibleSection({ title, children, defaultOpen = false }: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/50 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        {title}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  )
}

// ── Smart payload panel ───────────────────────────────────────────────────

function PayloadPanel({ event }: { event: StepEvent }) {
  const payload = event.payload

  if (!payload) {
    return <p className="text-xs text-muted-foreground italic">No payload recorded for this event.</p>
  }

  const prompt       = typeof payload['prompt'] === 'string' ? payload['prompt'] : null
  const systemPrompt = typeof payload['system_prompt'] === 'string' ? payload['system_prompt'] : null
  const responseJson = payload['response_json'] != null ? safeParseJson(payload['response_json']) : null
  const downloadUrl  = typeof payload['download_url'] === 'string' ? payload['download_url'] : null

  const directionLabel =
    event.direction === 'out' ? `→ Sent to ${event.serviceName ?? 'service'}` :
    event.direction === 'in'  ? `← Received from ${event.serviceName ?? 'service'}` :
    'Internal event'

  // For non-structured payloads, just show raw JSON
  const hasStructured = prompt || responseJson || downloadUrl

  // Build "other fields" (everything except known structured keys)
  const KNOWN_KEYS = new Set(['prompt', 'system_prompt', 'response_json', 'download_url'])
  const otherFields = Object.fromEntries(
    Object.entries(payload).filter(([k]) => !KNOWN_KEYS.has(k))
  )
  const hasOtherFields = Object.keys(otherFields).length > 0

  return (
    <div className="space-y-3">
      {/* Direction label */}
      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-md ${
        event.direction === 'out' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
        event.direction === 'in'  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
        'bg-muted/50 text-muted-foreground'
      }`}>
        <DirectionIcon direction={event.direction} />
        {directionLabel}
        {event.endpoint && (
          <span className="font-mono font-normal truncate max-w-48 ml-1 opacity-70" title={event.endpoint}>
            {event.endpoint.replace('http://', '').replace(':8011', '').replace(':8012', '').replace(':8010', '').replace(':3100', '')}
          </span>
        )}
        {event.httpStatus != null && (
          <span className={`ml-auto shrink-0 ${event.httpStatus < 400 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
            {event.httpStatus}
          </span>
        )}
        {event.latencyMs != null && (
          <span className="text-muted-foreground shrink-0">{event.latencyMs}ms</span>
        )}
      </div>

      {/* Attachment reference */}
      {downloadUrl && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            Attachment
          </p>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            View / Download Attachment
          </a>
        </div>
      )}

      {/* Prompt (email body or attachment text sent to LLM) */}
      {prompt && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            {event.direction === 'out' ? '→ Prompt (sent)' : '← Prompt (received)'}
          </p>
          <pre className="text-xs bg-muted/40 border rounded-md p-3 overflow-auto max-h-80 font-mono text-foreground/80 whitespace-pre-wrap break-words">
            {prompt}
          </pre>
        </div>
      )}

      {/* System prompt (collapsible) */}
      {systemPrompt && (
        <CollapsibleSection title="System Prompt">
          <pre className="text-xs bg-muted/40 p-3 overflow-auto max-h-48 font-mono text-foreground/80 whitespace-pre-wrap">
            {systemPrompt}
          </pre>
        </CollapsibleSection>
      )}

      {/* LLM response JSON — extracted parameters */}
      {responseJson && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            ← LLM Extracted Parameters
          </p>
          <pre className="text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 overflow-auto max-h-64 font-mono text-foreground/80 whitespace-pre-wrap">
            {JSON.stringify(responseJson, null, 2)}
          </pre>
        </div>
      )}

      {/* Other structured fields */}
      {hasOtherFields && (
        <CollapsibleSection title={hasStructured ? 'Other Fields' : 'Payload'} defaultOpen={!hasStructured}>
          <pre className="text-xs bg-muted/40 p-3 overflow-auto max-h-64 font-mono text-foreground/80 whitespace-pre-wrap break-all">
            {JSON.stringify(otherFields, null, 2)}
          </pre>
        </CollapsibleSection>
      )}

      {/* If nothing structured, show full raw payload */}
      {!hasStructured && !hasOtherFields && (
        <pre className="text-xs bg-muted/40 border rounded-md p-3 overflow-auto max-h-64 font-mono text-foreground/80 whitespace-pre-wrap break-all">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface ExecutionLogViewerProps {
  intakeId?: string
  onClose?: () => void
  embedded?: boolean
}

export default function ExecutionLogViewer({ intakeId: intakeIdProp, onClose, embedded = false }: ExecutionLogViewerProps) {
  const params = useParams<{ intakeId: string }>()
  const navigate = useNavigate()
  const intakeId = intakeIdProp ?? params.intakeId ?? ''

  const [data, setData]         = useState<AuditData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!intakeId) return
    setLoading(true)
    try {
      setData(await integrationsApi.getAudit(intakeId))
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [intakeId])

  useEffect(() => { load() }, [load])

  const selectedEvent = data?.events.find(e => e.id === selectedId) ?? null

  const duration = data
    ? Math.round((new Date(data.intake.updatedAt).getTime() - new Date(data.intake.createdAt).getTime()) / 1000)
    : 0

  // Step-separator tracking
  let prevStepKey = ''

  return (
    <div className={`flex flex-col ${embedded ? 'h-full' : 'h-screen max-h-[90vh]'} bg-background`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2.5">
          <ScrollText className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm">Audit Log</span>
          {intakeId && (
            <span className="font-mono text-xs text-muted-foreground">
              {intakeId.slice(0, 8)}…
            </span>
          )}
          {data && <StatusBadge status={data.intake.status} />}
        </div>
        <div className="flex items-center gap-2">
          {!embedded && intakeId && (
            <Button
              size="sm" variant="ghost"
              onClick={() => navigate(`/analysis/${intakeId}`)}
              className="h-7 px-2 gap-1 text-xs text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Analysis
            </Button>
          )}
          <Button
            size="sm" variant="ghost"
            onClick={() => navigate('/audit')}
            className="h-7 px-2 gap-1 text-xs text-muted-foreground"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2 gap-1 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Meta strip ─────────────────────────────────────────────────── */}
      {data && (
        <div className="flex items-center gap-3 px-4 py-1.5 text-xs text-muted-foreground border-b bg-muted/20 shrink-0 flex-wrap">
          <span className="font-medium text-foreground truncate max-w-64">{data.intake.msgFilename}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{duration}s duration</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{data.eventCount} event{data.eventCount !== 1 ? 's' : ''}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{new Date(data.intake.createdAt).toLocaleString()}</span>
        </div>
      )}

      {/* ── Loading / error states ──────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          Loading audit events…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center flex-1 text-destructive text-sm gap-2">
          <AlertTriangle className="h-4 w-4" />
          Failed to load: {error}
        </div>
      )}

      {/* ── Two-panel body ──────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — event list ─────────────────────────────────────────── */}
          <div className="w-[380px] shrink-0 border-r overflow-y-auto">
            {data.events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                <ScrollText className="h-8 w-8 opacity-20" />
                <span>No events recorded yet.</span>
                {data.intake.status === 'processing' && (
                  <span className="text-xs">Events appear as n8n posts step updates.</span>
                )}
              </div>
            ) : (
              <div className="py-1">
                {data.events.map(evt => {
                  const showSeparator = evt.stepKey !== prevStepKey
                  prevStepKey = evt.stepKey
                  const isSelected = selectedId === evt.id

                  return (
                    <div key={evt.id}>
                      {showSeparator && (
                        <div className="flex items-center gap-2 px-3 py-1.5 mt-1 first:mt-0">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                            {stepLabel(evt.stepKey)}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}
                      <div
                        className={`flex items-start gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                          isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedId(isSelected ? null : evt.id)}
                      >
                        <span className="text-muted-foreground/50 tabular-nums shrink-0 mt-0.5">
                          {fmtTime(evt.createdAt)}
                        </span>
                        <div className="mt-0.5">
                          <DirectionIcon direction={evt.direction} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <EventPill eventType={evt.eventType} />
                            {evt.serviceName && (
                              <span className="text-muted-foreground font-mono">{evt.serviceName}</span>
                            )}
                            {!!evt.payload?.['prompt'] && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 rounded">prompt</span>
                            )}
                            {!!evt.payload?.['response_json'] && (
                              <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1 rounded">llm</span>
                            )}
                          </div>
                          {evt.logMessage && (
                            <p className="text-foreground/70 mt-0.5 truncate">{evt.logMessage}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT — payload detail ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedEvent ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                <ScrollText className="h-8 w-8 opacity-20" />
                <span>Select an event to inspect payload</span>
                <span className="text-xs">Events with <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 rounded">prompt</span> or <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1 rounded">llm</span> tags contain rich data</span>
              </div>
            ) : (
              <div className="space-y-3">

                {/* Step + event header */}
                <div className="text-xs text-muted-foreground font-mono">
                  {stepLabel(selectedEvent.stepKey)} · {new Date(selectedEvent.createdAt).toLocaleString()}
                </div>

                {/* Smart payload panel */}
                <PayloadPanel event={selectedEvent} />

                {/* Detail (extra metadata from n8n) */}
                {selectedEvent.detail != null && (
                  <CollapsibleSection title="Step Detail">
                    {selectedEvent.detail.drawing_b64 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Drawing Sent to LLM
                          </span>
                          <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                            PII redacted · {String(selectedEvent.detail.pii_regions_redacted ?? '?')} region(s)
                          </span>
                        </div>
                        <img
                          src={`data:image/png;base64,${selectedEvent.detail.drawing_b64}`}
                          alt="Redacted engineering drawing sent to LLM"
                          className="w-full border rounded-md"
                        />
                        {(() => {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          const { drawing_b64, ...rest } = selectedEvent.detail
                          return Object.keys(rest).length > 0 ? (
                            <pre className="text-xs bg-muted/40 p-3 overflow-auto max-h-32 font-mono text-foreground/80 whitespace-pre-wrap break-all">
                              {JSON.stringify(rest, null, 2)}
                            </pre>
                          ) : null
                        })()}
                      </div>
                    ) : (
                      <pre className="text-xs bg-muted/40 p-3 overflow-auto max-h-48 font-mono text-foreground/80 whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedEvent.detail, null, 2)}
                      </pre>
                    )}
                  </CollapsibleSection>
                )}

                {/* Log message */}
                {selectedEvent.logMessage && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Log</p>
                    <p className="text-xs font-mono text-foreground/80 bg-muted/40 border rounded-md px-3 py-2 break-all">
                      {selectedEvent.logMessage}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
