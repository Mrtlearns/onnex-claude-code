/* eslint-disable react-refresh/only-export-components */
/**
 * ExecutionLogPanel — activity log Card + completion summary cards for AnalysisPage
 */
import { RefObject } from 'react'
import { Activity, Loader2, CheckCircle2, XCircle, AlertTriangle, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LogEntry, StepStatus } from './PipelineStatusPanel'

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

interface ExecutionLogPanelProps {
  logEntries: LogEntry[]
  selectedStep: string | null
  logRef: RefObject<HTMLDivElement | null>
}

export default function ExecutionLogPanel({ logEntries, selectedStep, logRef }: ExecutionLogPanelProps) {
  return (
    <Card className="lg:col-span-3 flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Log
          </span>
          <span className="text-xs font-normal normal-case">
            {logEntries.length} event{logEntries.length !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-hidden">
        <div
          ref={logRef}
          className="h-[520px] overflow-y-auto font-mono text-xs space-y-1 pr-1"
        >
          {logEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Waiting for pipeline events…</span>
            </div>
          ) : (
            logEntries.map((entry, i) => {
              const dot =
                entry.status === 'success'    ? '✓' :
                entry.status === 'failed'     ? '✗' :
                entry.status === 'processing' ? '▶' :
                entry.status === 'skipped'    ? '—' : '○'

              const dotColor =
                entry.status === 'success'    ? 'text-green-500' :
                entry.status === 'failed'     ? 'text-red-500' :
                entry.status === 'processing' ? 'text-blue-500' :
                'text-muted-foreground'

              const stepColor =
                entry.status === 'success'    ? 'text-green-600 dark:text-green-400' :
                entry.status === 'failed'     ? 'text-red-600 dark:text-red-400' :
                entry.status === 'processing' ? 'text-blue-600 dark:text-blue-400' :
                'text-muted-foreground'

              return (
                <div
                  key={i}
                  className={`flex gap-2 leading-relaxed py-0.5 px-1 rounded ${
                    entry.stepKey === selectedStep ? 'bg-muted' : 'hover:bg-muted/40'
                  }`}
                >
                  <span className="text-muted-foreground/50 shrink-0 tabular-nums">
                    {fmtTime(entry.timestamp)}
                  </span>
                  <span className={`shrink-0 ${dotColor}`}>{dot}</span>
                  <span className={`shrink-0 font-semibold ${stepColor}`}>
                    [{entry.stepLabel.toUpperCase().replace(/ /g, '_')}]
                  </span>
                  <span className="text-foreground/80 break-all">
                    {entry.message}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Re-export StepStatus for consumers that only import from this file
export type { StepStatus }

// ── PipelineResultCards ────────────────────────────────────────────────────

interface PipelineResultCardsProps {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'stalled'
  doneCount: number
  quoteId: string | null
  isDemo: boolean
  intakeId: string | undefined
  onNavigate: (path: string) => void
}

export function PipelineResultCards({ status, doneCount, quoteId, isDemo, intakeId, onNavigate }: PipelineResultCardsProps) {
  return (
    <>
      {status === 'completed' && (
        <Card className="border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/10">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Pipeline completed successfully</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {doneCount} steps completed
                  {quoteId && <> · Quote <span className="font-mono font-medium">{quoteId}</span> created</>}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {quoteId && (
                <Button size="sm" onClick={() => onNavigate('/quotes')} className="bg-green-600 hover:bg-green-700 text-white">
                  View Quote
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onNavigate('/')}>Back to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'failed' && (
        <Card className="border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 dark:bg-red-900/40 p-2.5">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Pipeline failed or blocked</p>
                <p className="text-sm text-red-600 dark:text-red-400">Check the activity log and comply review queue for details</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onNavigate('/')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      )}

      {status === 'stalled' && (
        <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Pipeline stalled</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No activity for &gt;5 min — n8n may be paused or an upstream service is down
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isDemo && intakeId && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate(`/audit/${intakeId}`)}>
                  <ScrollText className="h-3.5 w-3.5" />
                  View Audit Log
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onNavigate('/')}>Back to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
