# Spec: Pinnable Sidebar + Feedback Widget with Screenshot Capture

> Ported from: `ndt-portal-v1`
> Target: `AI-OS-POC` (Next.js App Router, next-auth, Radix UI, Zustand, Tailwind)
> Status: Ready to implement

---

## Overview

Two independent features to add:

1. **Enhanced Sidebar** — upgrade the existing `sidebar.tsx` with hover-expand, pin-to-open, and localStorage persistence
2. **Feedback Widget** — floating button in the header that opens a modal with bug/feature reporting, screenshot region capture, freehand annotation, and n8n webhook delivery

---

## Part 1 — Enhanced Sidebar (Hover-Expand + Pin)

### Current State
`apps/web/src/components/layout/sidebar.tsx` supports a `collapsed` boolean prop and a `Menu` toggle button, but has no hover-expand behaviour or pinned persistence.

### Target Behaviour
| State | Width | Trigger |
|-------|-------|---------|
| Collapsed (unpinned) | 56px — icons only | Default |
| Hover-expanded | 220px — icons + labels | Mouse enters sidebar (80ms delay) |
| Pinned-open | 220px — icons + labels | User clicks pin button |

- **Pinned state** persists to `localStorage` key `sidebar_pinned` (boolean)
- **Hover-expand** only fires when sidebar is NOT pinned
- **80ms delay** before expanding on hover — prevents accidental expand during cursor transit
- Width transitions: `transition-[width] duration-200 ease-in-out`
- Text fade: `transition-[opacity,transform] duration-200` — text slides in from left when expanding

### Pin Button
- Positioned at the bottom of the sidebar, above the border
- Uses `Pin` / `PinOff` from `lucide-react`
- Tooltip: "Pin sidebar" / "Unpin sidebar"
- Only visible when sidebar is expanded (hover or pinned)

### State Logic

```typescript
// Internal to Sidebar component — no external state needed
const [pinned, setPinnedState] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('sidebar_pinned') === 'true'
})
const [hovering, setHovering] = useState(false)
const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

const open = pinned || hovering  // derived — drives width

function handleMouseEnter() {
  if (pinned) return
  hoverTimer.current = setTimeout(() => setHovering(true), 80)
}
function handleMouseLeave() {
  if (hoverTimer.current) clearTimeout(hoverTimer.current)
  if (!pinned) setHovering(false)
}
function togglePin() {
  const next = !pinned
  setPinnedState(next)
  localStorage.setItem('sidebar_pinned', String(next))
  if (!next) setHovering(false)
}
```

### Updated Sidebar JSX Structure (desktop)

```tsx
<div
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  className={cn(
    "hidden shrink-0 md:flex md:flex-col transition-[width] duration-200 ease-in-out overflow-hidden border-r bg-background",
    open ? "w-[220px]" : "w-14"
  )}
>
  {/* Logo / wordmark */}
  <div className="flex h-14 items-center border-b px-4 overflow-hidden">
    <span className="text-lg font-bold text-primary shrink-0">A</span>
    <span className={cn(
      "ml-2 text-lg font-bold text-primary whitespace-nowrap transition-[opacity,transform] duration-200",
      open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
    )}>I-OS</span>
  </div>

  {/* Nav items */}
  <SidebarNav role={role} open={open} />

  {/* Pin button — only when expanded */}
  <div className={cn(
    "border-t px-3 py-2 transition-[opacity] duration-200",
    open ? "opacity-100" : "opacity-0 pointer-events-none"
  )}>
    <button
      onClick={togglePin}
      className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
    >
      {pinned ? <PinOff className="h-3.5 w-3.5 shrink-0" /> : <Pin className="h-3.5 w-3.5 shrink-0" />}
      <span className="whitespace-nowrap overflow-hidden">
        {pinned ? "Unpin" : "Pin sidebar"}
      </span>
    </button>
  </div>
</div>
```

### Nav Item Adaptation

Pass `open` (not `collapsed`) to `SidebarNav` and `SidebarContent`:

```tsx
// In each nav item Link:
<Link ...>
  <Icon className="h-4 w-4 shrink-0" />
  <span className={cn(
    "whitespace-nowrap overflow-hidden transition-[opacity,transform] duration-200",
    open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 w-0"
  )}>
    {item.label}
  </span>
</Link>
```

### Remove External Collapse Control
The `collapsed` prop and `onToggleCollapse` callback can be removed from the component interface — the sidebar is now fully self-managed. Remove the `Menu` toggle button at the bottom. The `app-shell.tsx` no longer needs to track sidebar state.

### Dependencies
None new — `lucide-react` already installed (`Pin`, `PinOff` icons).

---

## Part 2 — Feedback Widget

### Architecture

```
Header (header.tsx)
  └── FeedbackButton          — ghost button, MessageSquarePlus icon
        └── FeedbackModal     — Radix Dialog
              ├── Form fields  (type, priority, description)
              ├── "Capture region…" button
              │     └── html2canvas → full viewport PNG
              │           └── ScreenCaptureOverlay  — drag to select region
              │                 └── AnnotationCanvas  — draw/text/arrow tools
              └── Submit → POST /api/feedback → n8n webhook
```

### Phase State Machine

```typescript
type Phase =
  | 'idle'        // form open, no screenshot
  | 'capturing'   // html2canvas running (dialog hidden)
  | 'selecting'   // ScreenCaptureOverlay visible
  | 'annotating'  // AnnotationCanvas open
  | 'submitting'  // POST in flight
  | 'done'        // success, auto-close after 2000ms
```

### File Structure

```
apps/web/src/components/feedback/
  FeedbackButton.tsx
  FeedbackModal.tsx
  ScreenCaptureOverlay.tsx
  AnnotationCanvas.tsx
```

---

### FeedbackButton.tsx

```tsx
"use client"
import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { FeedbackModal } from "./FeedbackModal"

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs
                   text-muted-foreground hover:text-foreground hover:bg-muted
                   transition-colors"
        title="Send feedback"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span>Feedback</span>
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

---

### FeedbackModal.tsx

```tsx
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
```

---

### ScreenCaptureOverlay.tsx

Renders to `document.body` via a React portal. Full-viewport fixed overlay with drag-to-select region.

```tsx
"use client"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

interface Props {
  screenshotDataUrl: string
  onCapture: (croppedDataUrl: string) => void
  onCancel: () => void
}

export function ScreenCaptureOverlay({ screenshotDataUrl, onCapture, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    startX.current = e.clientX
    startY.current = e.clientY
    if (selRef.current) {
      selRef.current.style.left = `${e.clientX}px`
      selRef.current.style.top = `${e.clientY}px`
      selRef.current.style.width = '0px'
      selRef.current.style.height = '0px'
      selRef.current.style.display = 'block'
    }
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !selRef.current) return
      const x = Math.min(e.clientX, startX.current)
      const y = Math.min(e.clientY, startY.current)
      const w = Math.abs(e.clientX - startX.current)
      const h = Math.abs(e.clientY - startY.current)
      selRef.current.style.left = `${x}px`
      selRef.current.style.top = `${y}px`
      selRef.current.style.width = `${w}px`
      selRef.current.style.height = `${h}px`
    }

    function onMouseUp(e: MouseEvent) {
      if (!dragging.current) return
      dragging.current = false
      const x = Math.min(e.clientX, startX.current)
      const y = Math.min(e.clientY, startY.current)
      const w = Math.abs(e.clientX - startX.current)
      const h = Math.abs(e.clientY - startY.current)
      if (w < 10 || h < 10) return  // too small, ignore
      cropRegion(x, y, w, h)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function cropRegion(x: number, y: number, w: number, h: number) {
    const img = imgRef.current
    if (!img) return
    const scaleX = img.naturalWidth / window.innerWidth
    const scaleY = img.naturalHeight / window.innerHeight
    const canvas = document.createElement('canvas')
    canvas.width = w * scaleX
    canvas.height = h * scaleY
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, x * scaleX, y * scaleY, w * scaleX, h * scaleY, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/png'))
  }

  const content = (
    <div
      ref={overlayRef}
      onMouseDown={onMouseDown}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, cursor: 'crosshair', userSelect: 'none' }}
    >
      {/* Full page screenshot as background */}
      <img
        ref={imgRef}
        src={screenshotDataUrl}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {/* Dark tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      {/* Selection rect — punches through tint via box-shadow */}
      <div
        ref={selRef}
        style={{
          display: 'none',
          position: 'absolute',
          border: '2px solid #3b82f6',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}
      />
      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 6,
        padding: '6px 14px', fontSize: 13,
      }}>
        Drag to select a region · Esc to cancel
      </div>
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null
}
```

---

### AnnotationCanvas.tsx

Full-page annotation tool rendered over the cropped screenshot. Tools: pen (freehand), text (click to place), arrow (with arrowhead).

```tsx
"use client"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Pen, Type, ArrowRight, Undo2, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Tool = 'pen' | 'text' | 'arrow'
type Color = '#ef4444' | '#facc15' | '#3b82f6' | '#ffffff'

interface PenOp   { type: 'pen';   points: {x:number;y:number}[]; color: Color; width: number }
interface TextOp  { type: 'text';  x: number; y: number; text: string; color: Color; size: number }
interface ArrowOp { type: 'arrow'; x1:number; y1:number; x2:number; y2:number; color: Color; width: number }
type DrawOp = PenOp | TextOp | ArrowOp

export interface AnnotationCanvasHandle {
  getAnnotatedDataUrl: () => string
}

interface Props {
  imageDataUrl: string
  onDone: () => void
  onCancel: () => void
}

const COLORS: Color[] = ['#ef4444', '#facc15', '#3b82f6', '#ffffff']
const WIDTHS = [2, 5, 10]

export const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, Props>(
  function AnnotationCanvas({ imageDataUrl, onDone, onCancel }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imgRef = useRef<HTMLImageElement | null>(null)
    const [tool, setTool] = useState<Tool>('pen')
    const [color, setColor] = useState<Color>('#ef4444')
    const [width, setWidth] = useState(5)
    const [ops, setOps] = useState<DrawOp[]>([])
    const [textInput, setTextInput] = useState<{x:number;y:number}|null>(null)
    const [textValue, setTextValue] = useState('')
    const drawing = useRef(false)
    const currentPen = useRef<{x:number;y:number}[]>([])
    const arrowStart = useRef<{x:number;y:number}|null>(null)
    const mousePos = useRef<{x:number;y:number}>({x:0,y:0})

    useImperativeHandle(ref, () => ({
      getAnnotatedDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? imageDataUrl
    }))

    // Load image and set canvas size
    useEffect(() => {
      const img = new Image()
      img.onload = () => {
        imgRef.current = img
        const canvas = canvasRef.current!
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        redraw([])
      }
      img.src = imageDataUrl
    }, [imageDataUrl]) // eslint-disable-line react-hooks/exhaustive-deps

    function redraw(currentOps: DrawOp[], preview?: DrawOp) {
      const canvas = canvasRef.current
      const img = imgRef.current
      if (!canvas || !img) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      ;[...currentOps, ...(preview ? [preview] : [])].forEach(op => drawOp(ctx, op))
    }

    function drawOp(ctx: CanvasRenderingContext2D, op: DrawOp) {
      ctx.strokeStyle = op.color
      ctx.fillStyle = op.color
      if (op.type === 'pen') {
        ctx.lineWidth = op.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        op.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
        ctx.stroke()
      } else if (op.type === 'text') {
        ctx.font = `bold ${op.size}px sans-serif`
        ctx.fillText(op.text, op.x, op.y)
      } else if (op.type === 'arrow') {
        const { x1, y1, x2, y2 } = op
        ctx.lineWidth = op.width
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        // arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const len = Math.max(14, op.width * 4)
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - len * Math.cos(angle - Math.PI / 6), y2 - len * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - len * Math.cos(angle + Math.PI / 6), y2 - len * Math.sin(angle + Math.PI / 6))
        ctx.stroke()
      }
    }

    function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const scaleX = canvasRef.current!.width / rect.width
      const scaleY = canvasRef.current!.height / rect.height
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    }

    function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
      const pos = getCanvasPos(e)
      if (tool === 'text') {
        setTextInput(pos)
        setTextValue('')
        return
      }
      drawing.current = true
      if (tool === 'pen') currentPen.current = [pos]
      if (tool === 'arrow') arrowStart.current = pos
    }

    function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
      const pos = getCanvasPos(e)
      mousePos.current = pos
      if (!drawing.current) return
      if (tool === 'pen') {
        currentPen.current = [...currentPen.current, pos]
        redraw(ops, { type: 'pen', points: currentPen.current, color, width })
      } else if (tool === 'arrow' && arrowStart.current) {
        redraw(ops, { type: 'arrow', x1: arrowStart.current.x, y1: arrowStart.current.y, x2: pos.x, y2: pos.y, color, width })
      }
    }

    function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
      if (!drawing.current) return
      drawing.current = false
      const pos = getCanvasPos(e)
      if (tool === 'pen' && currentPen.current.length > 1) {
        const newOps = [...ops, { type: 'pen' as const, points: currentPen.current, color, width }]
        setOps(newOps)
        redraw(newOps)
      } else if (tool === 'arrow' && arrowStart.current) {
        const newOps = [...ops, { type: 'arrow' as const, x1: arrowStart.current.x, y1: arrowStart.current.y, x2: pos.x, y2: pos.y, color, width }]
        setOps(newOps)
        redraw(newOps)
        arrowStart.current = null
      }
    }

    function commitText() {
      if (!textInput || !textValue.trim()) { setTextInput(null); return }
      const newOps = [...ops, { type: 'text' as const, x: textInput.x, y: textInput.y, text: textValue.trim(), color, size: width * 5 }]
      setOps(newOps)
      redraw(newOps)
      setTextInput(null)
      setTextValue('')
    }

    function undo() {
      const newOps = ops.slice(0, -1)
      setOps(newOps)
      redraw(newOps)
    }

    return (
      <div className="fixed inset-0 z-[99999] flex flex-col bg-black" style={{ userSelect: 'none' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border-b border-zinc-700 flex-wrap">
          {/* Tools */}
          <div className="flex gap-1">
            {([['pen', Pen], ['text', Type], ['arrow', ArrowRight]] as const).map(([t, Icon]) => (
              <button key={t} onClick={() => setTool(t)}
                className={`p-1.5 rounded ${tool === t ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-transparent'}`}
                style={{ background: c }} />
            ))}
          </div>

          {/* Widths */}
          <div className="flex items-center gap-1">
            {WIDTHS.map(w => (
              <button key={w} onClick={() => setWidth(w)}
                className={`px-2 py-1 rounded text-xs ${width === w ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                <div className="rounded-full bg-current" style={{ width: w * 2, height: w * 2, minWidth: 4 }} />
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={undo} className="gap-1 text-zinc-300 hover:text-white" disabled={ops.length === 0}>
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setOps([]); redraw([]) }} className="gap-1 text-zinc-300 hover:text-white">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} className="gap-1 text-zinc-400 hover:text-white">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={onDone} className="gap-1">
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              style={{ cursor: tool === 'text' ? 'text' : 'crosshair', maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain' }}
              className="rounded border border-zinc-600"
            />
            {textInput && (
              <input
                autoFocus
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null) }}
                onBlur={commitText}
                style={{
                  position: 'absolute',
                  left: textInput.x,
                  top: textInput.y,
                  fontSize: width * 5,
                  color,
                  background: 'transparent',
                  border: '1px dashed currentColor',
                  outline: 'none',
                  minWidth: 80,
                }}
              />
            )}
          </div>
        </div>
      </div>
    )
  }
)
```

---

### API Route — `apps/web/src/app/api/feedback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { z } from 'zod'

const FEEDBACK_TYPES = ['Bug Report', 'UI/UX Issue', 'Feature Request', 'Performance Issue', 'Data/Accuracy Issue', 'Other'] as const
const PRIORITY_LEVELS = ['Critical', 'High', 'Medium', 'Low'] as const

const schema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  priority: z.enum(PRIORITY_LEVELS),
  description: z.string().min(10).max(5000),
  page_url: z.string(),
  user_email: z.string(),
  user_name: z.string().max(200),
  screenshot_b64: z.string().startsWith('data:image/').optional(),
})

const N8N_FEEDBACK_WEBHOOK_URL = process.env.N8N_FEEDBACK_WEBHOOK_URL ?? 'http://n8n:5678/webhook/aios-feedback'
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET ?? ''

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const res = await fetch(N8N_FEEDBACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_WEBHOOK_SECRET ? { 'X-N8N-Token': N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error('[feedback] n8n returned', res.status)
      return NextResponse.json({ error: 'Webhook error' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[feedback] n8n unreachable', err)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
```

---

### Integration Points

**1. Add FeedbackButton to header**

In `apps/web/src/components/layout/header.tsx`, import and place `FeedbackButton` alongside the notification bell:

```tsx
import { FeedbackButton } from "@/components/feedback/FeedbackButton"

// Inside the header JSX, in the right-hand button group:
<FeedbackButton />
<NotificationBell />
```

**2. Update sidebar in app-shell**

In `apps/web/src/components/layout/app-shell.tsx`, remove the `collapsed` state and `onToggleCollapse` prop passing — the sidebar is now self-managing.

---

## Part 3 — n8n Workflow

### Trigger
**Webhook node** — path: `aios-feedback`, method: POST, authentication: Header Auth (`X-N8N-Token`)

### Recommended Flow

```
Webhook (POST /aios-feedback)
  → Set node (format Slack/email body)
  → IF screenshot_b64 exists
      → true branch: Convert base64 → binary → attach
      → false branch: skip
  → Slack / Email node (send notification to #feedback channel)
  → Respond to Webhook (200 OK)
```

### Slack message template
```
*[{{ $json.priority }}] {{ $json.type }}*
Page: {{ $json.page_url }}
Reporter: {{ $json.user_name }} ({{ $json.user_email }})

{{ $json.description }}
```

### Env vars to set in AI-OS-POC `.env`
```
N8N_FEEDBACK_WEBHOOK_URL=http://n8n:5678/webhook/aios-feedback
N8N_WEBHOOK_SECRET=<generate 32-char random hex>
```

---

## Part 4 — Dependencies

```bash
# In apps/web/
npm install html2canvas
```

`html2canvas` is the only new dependency. Everything else (`lucide-react`, `@radix-ui/react-dialog`, `clsx`, `tailwind-merge`) is already in `package.json`.

---

## Implementation Order

1. `npm install html2canvas` in `apps/web/`
2. Create `apps/web/src/components/feedback/` with the 4 files above
3. Create `apps/web/src/app/api/feedback/route.ts`
4. Add `FeedbackButton` to `header.tsx`
5. Upgrade `sidebar.tsx` with hover-expand + pin logic
6. Update `app-shell.tsx` to remove external collapse state
7. Set `N8N_FEEDBACK_WEBHOOK_URL` + `N8N_WEBHOOK_SECRET` in `.env`
8. Build the n8n feedback workflow

---

## Key Differences from ndt-portal-v1 Source

| Concern | ndt-portal-v1 | AI-OS-POC |
|---------|---------------|-----------|
| Auth | `oidc-client-ts` + `getAuthHeaders()` | `next-auth` + `getServerSession()` in API route |
| API endpoint | Express `POST /api/feedback` | Next.js route `POST /api/feedback/route.ts` |
| Auth check | JWT middleware | `getServerSession(authOptions)` |
| Dialog | Custom modal | Radix `Dialog` component |
| Theming | Custom CSS vars | `next-themes` + shadcn tokens |
| Sidebar state | Controlled via parent | Self-managed with `useState` + localStorage |
