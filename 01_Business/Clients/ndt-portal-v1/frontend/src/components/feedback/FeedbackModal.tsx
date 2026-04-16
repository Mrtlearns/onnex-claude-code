import { useState, useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api'
import ScreenCaptureOverlay from './ScreenCaptureOverlay'
import AnnotationCanvas, { type AnnotationCanvasHandle } from './AnnotationCanvas'
import {
  Camera, CheckCircle2, Loader2, Pencil, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────────

const FEEDBACK_TYPES = [
  'Bug Report',
  'UI/UX Issue',
  'Feature Request',
  'Performance Issue',
  'Data/Accuracy Issue',
  'Other',
] as const

const PRIORITIES = [
  { value: 'Critical', label: 'Critical — blocks work'          },
  { value: 'High',     label: 'High — significant impact'       },
  { value: 'Medium',   label: 'Medium — inconvenient'           },
  { value: 'Low',      label: 'Low — cosmetic / nice-to-have'   },
] as const

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase =
  | 'idle'        // form open, no screenshot yet
  | 'capturing'   // running html2canvas in background (dialog closed)
  | 'selecting'   // ScreenCaptureOverlay shown
  | 'annotating'  // AnnotationCanvas open inside dialog
  | 'submitting'  // sending to API
  | 'done'        // success

interface Props {
  open: boolean
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FeedbackModal({ open, onClose }: Props) {
  const { user } = useAuth()

  // Form state
  const [fbType,       setFbType]       = useState<string>('')
  const [priority,     setPriority]     = useState<string>('')
  const [description,  setDescription]  = useState('')
  const [error,        setError]        = useState('')

  // Screenshot / phase
  const [phase,          setPhase]          = useState<Phase>('idle')
  const [fullPageCapture, setFullPageCapture] = useState<string | null>(null)
  const [screenshot,      setScreenshot]     = useState<string | null>(null)  // cropped + annotated

  const annotationRef = useRef<AnnotationCanvasHandle>(null)

  // ── Reset ──────────────────────────────────────────────────────────────────
  function reset() {
    setFbType('')
    setPriority('')
    setDescription('')
    setError('')
    setPhase('idle')
    setFullPageCapture(null)
    setScreenshot(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  // ── Capture flow ───────────────────────────────────────────────────────────
  const startCapture = useCallback(async () => {
    setPhase('capturing')
    // Wait for the Dialog's 200ms exit animation to fully complete before capturing
    await new Promise(r => setTimeout(r, 350))

    try {
      const canvas = await html2canvas(document.body, {
        useCORS:  true,
        logging:  false,
        scale:    1,
        width:    window.innerWidth,
        height:   window.innerHeight,
        scrollX:  -window.scrollX,
        scrollY:  -window.scrollY,
        windowWidth:  window.innerWidth,
        windowHeight: window.innerHeight,
      })
      setFullPageCapture(canvas.toDataURL('image/png'))
      setPhase('selecting')
    } catch (e) {
      console.error('[feedback] html2canvas failed:', e)
      setPhase('idle')
    }
  }, [])

  function onCaptureSelected(croppedDataUrl: string) {
    setFullPageCapture(null)
    setScreenshot(croppedDataUrl)   // will be replaced by annotated version on Done
    setPhase('annotating')
  }

  function onCaptureCancel() {
    setFullPageCapture(null)
    setPhase('idle')
  }

  function doneAnnotating() {
    const dataUrl = annotationRef.current?.getAnnotatedDataUrl() ?? screenshot
    setScreenshot(dataUrl ?? null)
    setPhase('idle')
  }

  function discardScreenshot() {
    setScreenshot(null)
    setPhase('idle')
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError('')
    if (!fbType)              { setError('Please select a feedback type.');   return }
    if (!priority)            { setError('Please select a priority level.');  return }
    if (description.trim().length < 10) { setError('Description must be at least 10 characters.'); return }

    setPhase('submitting')

    const payload: Record<string, unknown> = {
      type:        fbType,
      priority,
      description: description.trim(),
      page_url:    window.location.href,
      user_email:  user?.email ?? '',
      user_name:   user?.name  ?? '',
    }
    if (screenshot) payload.screenshot_b64 = screenshot

    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPhase('done')
      setTimeout(() => { handleClose() }, 2000)
    } catch (e) {
      console.error('[feedback] submit failed:', e)
      setError('Failed to send feedback. Please try again.')
      setPhase('idle')
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const isAnnotating  = phase === 'annotating'
  const isSubmitting  = phase === 'submitting'
  const isDone        = phase === 'done'
  const isDialogOpen  = open && phase !== 'capturing' && phase !== 'selecting'
  const canSubmit     = !!fbType && !!priority && description.trim().length >= 10 && !isSubmitting

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Screen capture overlay (rendered outside Dialog) ─────────── */}
      {phase === 'selecting' && fullPageCapture && (
        <ScreenCaptureOverlay
          capturedDataUrl={fullPageCapture}
          onCapture={onCaptureSelected}
          onCancel={onCaptureCancel}
        />
      )}

      {/* ── Main dialog ──────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={v => { if (!v) handleClose() }}>
        <DialogContent className={cn('max-w-2xl max-h-[90vh] overflow-y-auto', isAnnotating && 'max-w-3xl')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isDone ? (
                <><CheckCircle2 className="h-5 w-5 text-green-500" /> Feedback sent!</>
              ) : (
                'Send Feedback'
              )}
            </DialogTitle>
          </DialogHeader>

          {isDone ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p>Your feedback has been received. Thank you!</p>
            </div>
          ) : isAnnotating && screenshot ? (
            // ── Annotation canvas ─────────────────────────────────────
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Annotate your screenshot using the tools below, then click <strong>Done</strong>.
              </p>
              <AnnotationCanvas ref={annotationRef} screenshotDataUrl={screenshot} />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={discardScreenshot}>
                  Discard screenshot
                </Button>
                <Button size="sm" onClick={doneAnnotating}>Done annotating</Button>
              </div>
            </div>
          ) : (
            // ── Feedback form ─────────────────────────────────────────
            <div className="flex flex-col gap-4">
              {/* Submitter */}
              {user && (
                <p className="text-xs text-muted-foreground">
                  Submitting as <span className="font-medium text-foreground">{user.name}</span>{' '}
                  <span className="opacity-60">({user.email})</span>
                </p>
              )}

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Feedback type <span className="text-destructive">*</span></Label>
                  <Select value={fbType} onValueChange={setFbType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Priority <span className="text-destructive">*</span></Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select priority…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the issue or suggestion in detail…"
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {description.trim().length}/5000
                  {description.trim().length > 0 && description.trim().length < 10 &&
                    <span className="text-amber-500"> · min 10 chars</span>
                  }
                </p>
              </div>

              {/* Screenshot */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Screenshot (optional)</Label>
                {screenshot ? (
                  <div className="flex items-start gap-3">
                    <div className="relative group">
                      <img
                        src={screenshot}
                        alt="Screenshot preview"
                        className="h-24 rounded border border-border object-contain bg-muted cursor-pointer"
                        onClick={() => setPhase('annotating')}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded transition-opacity cursor-pointer text-white gap-1 text-xs"
                           onClick={() => setPhase('annotating')}>
                        <Pencil className="h-3 w-3" /> Edit
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setPhase('annotating')}>
                        <Pencil className="h-3 w-3" /> Edit annotation
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setScreenshot(null)}>
                        <X className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full gap-2 border-dashed text-muted-foreground"
                    onClick={startCapture}
                    disabled={isSubmitting}
                  >
                    <Camera className="h-4 w-4" />
                    Capture region…
                  </Button>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          )}

          {/* Footer — only show during normal form phase */}
          {!isDone && !isAnnotating && (
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending…</>
                ) : (
                  'Send Feedback'
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
