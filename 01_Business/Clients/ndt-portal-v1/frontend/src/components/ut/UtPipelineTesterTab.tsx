import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Play, Copy, Upload, ChevronDown, ChevronRight, FlaskConical, Paperclip, Loader2 } from 'lucide-react'
import { PIPELINE_STEPS, StatusDot, StepStatusBadge, CATEGORY_STYLE } from '../analysis/PipelineStatusPanel'
import type { StepStatus } from '../analysis/PipelineStatusPanel'
import { getAuthHeaders } from '@/lib/api'

// Dependency metadata — keyed on step.key
const STEP_META: Record<string, { dependsOn?: string; usePreviousField?: string }> = {
  intake:          {},
  email_sanitize:  { dependsOn: 'intake' },
  email_llm:       { dependsOn: 'email_sanitize', usePreviousField: 'sanitized_text' },
  comply_classify: {},
  compliance_gate: { dependsOn: 'comply_classify', usePreviousField: 'routing' },
  sanitize_pii:    { dependsOn: 'comply_classify', usePreviousField: 'sanitized_text' },
  type_detection:  { dependsOn: 'intake' },
  preprocessor:    { dependsOn: 'type_detection', usePreviousField: 'primaryType' },
  llm_analysis:    { dependsOn: 'sanitize_pii', usePreviousField: 'sanitized_text' },
  assemble:        { dependsOn: 'llm_analysis' },
  quote_created:   { dependsOn: 'assemble', usePreviousField: 'quoteParams' },
}

type StepOutputRecord = { output: Record<string, unknown>; durationMs: number }

export default function UtPipelineTesterTab() {
  const [emailText,      setEmailText]      = useState('')
  const [emailFrom,      setEmailFrom]      = useState('')
  const [emailSubject,   setEmailSubject]   = useState('')
  const [attachedFile,   setAttachedFile]   = useState<File | null>(null)
  const [attachmentBase64, setAttachmentBase64] = useState<string>('')
  const [expandedStep,   setExpandedStep]   = useState<string | null>(null)
  const [stepOutputs,    setStepOutputs]    = useState<Record<string, StepOutputRecord | null>>({})
  const [stepRunning,    setStepRunning]    = useState<Record<string, boolean>>({})
  const [stepError,      setStepError]      = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachedFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      // Strip the data URL prefix — keep only base64 content
      const base64 = result.split(',')[1] ?? result
      setAttachmentBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  function getStepStatus(stepKey: string): StepStatus {
    if (stepRunning[stepKey]) return 'processing'
    if (stepError[stepKey])   return 'failed'
    if (stepOutputs[stepKey]) return 'success'
    return 'pending'
  }

  function getPreviousOutput(stepKey: string): Record<string, unknown> | undefined {
    const meta = STEP_META[stepKey]
    if (!meta?.dependsOn) return undefined
    return stepOutputs[meta.dependsOn]?.output
  }

  async function runStep(stepKey: string) {
    setStepRunning(prev => ({ ...prev, [stepKey]: true }))
    setStepError(prev => ({ ...prev, [stepKey]: '' }))
    try {
      const prevOutput = getPreviousOutput(stepKey)
      const res = await fetch('/api/pipeline-tester/run-step', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body:    JSON.stringify({
          stepKey,
          emailText:        emailText || undefined,
          emailFrom:        emailFrom || undefined,
          emailSubject:     emailSubject || undefined,
          attachmentBase64: attachmentBase64 || undefined,
          attachmentName:   attachedFile?.name,
          attachmentMime:   attachedFile?.type,
          previousOutput:   prevOutput,
        }),
      })
      const data = await res.json() as { stepKey: string; output: Record<string, unknown>; durationMs: number; error?: string }
      if (data.error && !data.output) {
        setStepError(prev => ({ ...prev, [stepKey]: data.error! }))
      } else {
        setStepOutputs(prev => ({ ...prev, [stepKey]: { output: data.output, durationMs: data.durationMs } }))
      }
    } catch (e) {
      setStepError(prev => ({ ...prev, [stepKey]: String(e) }))
    } finally {
      setStepRunning(prev => ({ ...prev, [stepKey]: false }))
    }
  }

  function copyOutput(stepKey: string) {
    const out = stepOutputs[stepKey]?.output
    if (!out) return
    void navigator.clipboard.writeText(JSON.stringify(out, null, 2))
  }

  function useOutputInNext(stepKey: string) {
    const stepIdx   = PIPELINE_STEPS.findIndex(s => s.key === stepKey)
    const nextStep  = PIPELINE_STEPS[stepIdx + 1]
    if (nextStep) {
      setExpandedStep(nextStep.key)
    }
  }

  function toggleStep(stepKey: string) {
    setExpandedStep(prev => (prev === stepKey ? null : stepKey))
  }

  return (
    <div className="space-y-4">

      {/* Email Input Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Test Input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">From</label>
              <Input
                placeholder="sender@example.com"
                value={emailFrom}
                onChange={e => setEmailFrom(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex-[3]">
              <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
              <Input
                placeholder="Email subject line"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Email body</label>
            <Textarea
              placeholder="Paste email body here…"
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              rows={6}
              className="font-mono text-xs resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach PDF / Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff"
              className="hidden"
              onChange={handleFileChange}
            />
            {attachedFile && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Upload className="h-3 w-3" />
                {attachedFile.name}
                <span className="text-muted-foreground/60">({Math.round(attachedFile.size / 1024)} kb)</span>
                <button
                  onClick={() => { setAttachedFile(null); setAttachmentBase64('') }}
                  className="ml-1 text-destructive hover:text-destructive/80 text-xs"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Steps Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pipeline Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-0.5">
          {PIPELINE_STEPS.map(step => {
            const status    = getStepStatus(step.key)
            const isExpanded = expandedStep === step.key
            const catStyle  = CATEGORY_STYLE[step.category]
            const Icon      = step.icon
            const result    = stepOutputs[step.key]
            const error     = stepError[step.key]
            const meta      = STEP_META[step.key] ?? {}

            const stepIdx   = PIPELINE_STEPS.findIndex(s => s.key === step.key)
            const nextStep  = PIPELINE_STEPS[stepIdx + 1]

            return (
              <div key={step.key} className="rounded-lg border border-transparent hover:border-border/50 transition-colors">
                {/* Step row */}
                <div
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer ${isExpanded ? 'bg-muted' : 'hover:bg-muted/40'}`}
                  onClick={() => toggleStep(step.key)}
                >
                  {isExpanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  }

                  <StatusDot status={status} />

                  <div
                    title={catStyle.label}
                    className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${catStyle.bg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${catStyle.text}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{step.key}</span>
                      <span className="text-sm font-medium truncate">{step.label}</span>
                      {meta.dependsOn && (
                        <span className="text-xs text-muted-foreground/60 hidden sm:inline">
                          ← {meta.dependsOn}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs"
                      disabled={stepRunning[step.key]}
                      onClick={() => runStep(step.key)}
                    >
                      {stepRunning[step.key]
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Play className="h-3 w-3" />
                      }
                      Run
                    </Button>
                    <StepStatusBadge status={status} />
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <Separator />

                    {/* Input section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Input</span>
                        {meta.dependsOn && (
                          <Badge variant="outline" className="text-xs">
                            uses output from: {meta.dependsOn}
                            {meta.usePreviousField && ` → ${meta.usePreviousField}`}
                          </Badge>
                        )}
                      </div>
                      <div className="rounded-md bg-muted/50 p-3 text-xs font-mono text-muted-foreground space-y-1">
                        {emailText && (
                          <div>
                            <span className="font-semibold text-foreground/70">emailText:</span>{' '}
                            <span>{emailText.slice(0, 120)}{emailText.length > 120 ? '…' : ''}</span>
                          </div>
                        )}
                        {emailFrom && (
                          <div>
                            <span className="font-semibold text-foreground/70">emailFrom:</span>{' '}
                            <span>{emailFrom}</span>
                          </div>
                        )}
                        {emailSubject && (
                          <div>
                            <span className="font-semibold text-foreground/70">emailSubject:</span>{' '}
                            <span>{emailSubject}</span>
                          </div>
                        )}
                        {meta.dependsOn && getPreviousOutput(step.key) && (
                          <div>
                            <span className="font-semibold text-foreground/70">previousOutput ({meta.dependsOn}):</span>{' '}
                            <span className="text-muted-foreground/60">
                              {JSON.stringify(getPreviousOutput(step.key)).slice(0, 120)}…
                            </span>
                          </div>
                        )}
                        {!emailText && !meta.dependsOn && (
                          <span className="italic text-muted-foreground/50">No input configured — fill in email body above</span>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={stepRunning[step.key]}
                      onClick={() => runStep(step.key)}
                    >
                      {stepRunning[step.key]
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Play className="h-3.5 w-3.5" />
                      }
                      Run this step
                    </Button>

                    {/* Error */}
                    {error && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-mono">
                        {error}
                      </div>
                    )}

                    {/* Output section */}
                    {result && (
                      <div className="space-y-2">
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Output</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {result.durationMs}ms
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs gap-1"
                              onClick={() => copyOutput(step.key)}
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </Button>
                          </div>
                        </div>
                        <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                          {JSON.stringify(result.output, null, 2)}
                        </pre>
                        {nextStep && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1.5 text-xs"
                            onClick={() => useOutputInNext(step.key)}
                          >
                            <Play className="h-3 w-3" />
                            Use output in next step ({nextStep.key})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
