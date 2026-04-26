"use client"
import { useRef, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Camera, X } from "lucide-react"
import { ScreenCaptureOverlay } from "./ScreenCaptureOverlay"
import { AnnotationCanvas, type AnnotationCanvasHandle } from "./AnnotationCanvas"

const FEEDBACK_TYPES = [
  "Bug Report", "UI/UX Issue", "Feature Request",
  "Performance Issue", "Data/Accuracy Issue", "Other",
] as const

const PRIORITY_LEVELS = ["Critical", "High", "Medium", "Low"] as const

type Phase = 'idle' | 'capturing' | 'selecting' | 'annotating' | 'submitting' | 'done'

interface Props { open: boolean; onClose: () => void }

export function FeedbackModal({ open, onClose }: Props) {
  const { data: session } = useSession()
  const [phase, setPhase] = useState<Phase>('idle')
  const [type, setType] = useState<string>(FEEDBACK_TYPES[0])
  const [priority, setPriority] = useState<string>("Medium")
  const [description, setDescription] = useState("")
  const [fullPageCapture, setFullPageCapture] = useState<string | null>(null)
  const [croppedScreenshot, setCroppedScreenshot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const annotationRef = useRef<AnnotationCanvasHandle>(null)

  // Capture full page → show region selector
  async function startCapture() {
    setPhase('capturing')
    // Close dialog, wait for exit animation + repaint
    await new Promise(r => setTimeout(r, 350))
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      scale: 1,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
    })
    setFullPageCapture(canvas.toDataURL('image/png'))
    setPhase('selecting')
  }

  function handleRegionCaptured(dataUrl: string) {
    setCroppedScreenshot(dataUrl)
    setPhase('annotating')
  }

  function handleAnnotationDone() {
    if (annotationRef.current) {
      setCroppedScreenshot(annotationRef.current.getAnnotatedDataUrl())
    }
    setPhase('idle')
  }

  function clearScreenshot() {
    setCroppedScreenshot(null)
    setFullPageCapture(null)
  }

  async function handleSubmit() {
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters.")
      return
    }
    setError(null)
    setPhase('submitting')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          priority,
          description: description.trim(),
          page_url: window.location.href,
          user_email: session?.user?.email ?? '',
          user_name: session?.user?.name ?? '',
          screenshot_b64: croppedScreenshot ?? undefined,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPhase('done')
      setTimeout(() => {
        onClose()
        setPhase('idle')
        setDescription("")
        setCroppedScreenshot(null)
        setFullPageCapture(null)
      }, 2000)
    } catch {
      setError("Failed to send feedback. Please try again.")
      setPhase('idle')
    }
  }

  // Overlay states — render outside Dialog
  if (phase === 'selecting' && fullPageCapture) {
    return (
      <ScreenCaptureOverlay
        screenshotDataUrl={fullPageCapture}
        onCapture={handleRegionCaptured}
        onCancel={() => { setFullPageCapture(null); setPhase('idle') }}
      />
    )
  }
  if (phase === 'annotating' && croppedScreenshot) {
    return (
      <AnnotationCanvas
        ref={annotationRef}
        imageDataUrl={croppedScreenshot}
        onDone={handleAnnotationDone}
        onCancel={() => setPhase('idle')}
      />
    )
  }

  return (
    <Dialog open={open && phase !== 'capturing'} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        {phase === 'done' ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ✓ Feedback sent — thank you!
          </p>
        ) : (
          <div className="space-y-4">
            {/* Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {FEEDBACK_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Priority</Label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PRIORITY_LEVELS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description <span className="text-muted-foreground">(min 10 chars)</span></Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                maxLength={5000}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Describe the issue or request…"
              />
            </div>

            {/* Screenshot */}
            <div>
              <Label>Screenshot (optional)</Label>
              {croppedScreenshot ? (
                <div className="mt-1 relative">
                  <img
                    src={croppedScreenshot}
                    alt="Captured screenshot"
                    className="rounded border max-h-40 object-contain w-full bg-muted"
                  />
                  <button
                    onClick={clearScreenshot}
                    className="absolute top-1 right-1 rounded-full bg-background/80 p-1 hover:bg-background"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1.5"
                  onClick={startCapture}
                  disabled={phase === 'capturing'}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {phase === 'capturing' ? "Capturing…" : "Capture region…"}
                </Button>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {phase !== 'done' && (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={phase === 'submitting'}>
              {phase === 'submitting' ? "Sending…" : "Send Feedback"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
