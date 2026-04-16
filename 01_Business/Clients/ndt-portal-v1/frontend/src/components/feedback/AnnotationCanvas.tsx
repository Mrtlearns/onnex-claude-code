import {
  useRef, useState, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import { Pencil, Type, MoveRight, Undo2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'text' | 'arrow'
type Color = '#ef4444' | '#facc15' | '#3b82f6' | '#ffffff'

interface PenOp {
  type: 'pen'
  points: { x: number; y: number }[]
  color: Color
  width: number
}
interface TextOp {
  type: 'text'
  x: number
  y: number
  text: string
  color: Color
  size: number
}
interface ArrowOp {
  type: 'arrow'
  x1: number; y1: number
  x2: number; y2: number
  color: Color
  width: number
}

type DrawOp = PenOp | TextOp | ArrowOp

export interface AnnotationCanvasHandle {
  getAnnotatedDataUrl: () => string
}

interface Props {
  screenshotDataUrl: string
}

const COLORS: Color[] = ['#ef4444', '#facc15', '#3b82f6', '#ffffff']
const WIDTHS = [2, 5, 10]

// ── Drawing helpers ────────────────────────────────────────────────────────────

function drawOp(ctx: CanvasRenderingContext2D, op: DrawOp) {
  ctx.save()
  ctx.lineCap  = 'round'
  ctx.lineJoin = 'round'

  if (op.type === 'pen') {
    if (op.points.length < 2) { ctx.restore(); return }
    ctx.strokeStyle = op.color
    ctx.lineWidth   = op.width
    ctx.beginPath()
    ctx.moveTo(op.points[0].x, op.points[0].y)
    for (const p of op.points.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  if (op.type === 'text') {
    ctx.fillStyle = op.color
    ctx.font      = `bold ${op.size}px sans-serif`
    ctx.fillText(op.text, op.x, op.y)
  }

  if (op.type === 'arrow') {
    const { x1, y1, x2, y2, color, width } = op
    const dx = x2 - x1; const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 5) { ctx.restore(); return }
    const ux = dx / len; const uy = dy / len
    const headLen = Math.max(14, width * 4)
    const headAngle = 0.45 // radians

    ctx.strokeStyle = color
    ctx.fillStyle   = color
    ctx.lineWidth   = width

    // Shaft
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2 - ux * headLen * 0.5, y2 - uy * headLen * 0.5)
    ctx.stroke()

    // Arrowhead
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(
      x2 - headLen * Math.cos(headAngle - Math.atan2(dy, dx)) * -1 * -1,
      y2 - headLen * Math.sin(headAngle - Math.atan2(dy, dx)) * -1 * -1,
    )
    // Simple filled triangle head
    const angle = Math.atan2(dy, dx)
    ctx.moveTo(x2, y2)
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - headAngle),
      y2 - headLen * Math.sin(angle - headAngle),
    )
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + headAngle),
      y2 - headLen * Math.sin(angle + headAngle),
    )
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function redrawAll(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  ops: DrawOp[],
  preview?: DrawOp,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const op of ops) drawOp(ctx, op)
  if (preview) drawOp(ctx, preview)
}

// ── Component ──────────────────────────────────────────────────────────────────

const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, Props>(
  ({ screenshotDataUrl }, ref) => {
    const canvasRef    = useRef<HTMLCanvasElement>(null)
    const imgRef       = useRef<HTMLImageElement | null>(null)
    const [tool,   setTool]   = useState<Tool>('pen')
    const [color,  setColor]  = useState<Color>('#ef4444')
    const [width,  setWidth]  = useState<number>(3)
    const [ops,    setOps]    = useState<DrawOp[]>([])
    const [mouse,  setMouse]  = useState<{ x: number; y: number } | null>(null)

    // Text input state
    const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null)
    const [textValue, setTextValue] = useState('')
    const textInputRef = useRef<HTMLInputElement>(null)

    // Drawing in-progress refs (avoid stale closure)
    const drawing    = useRef(false)
    const currentPen = useRef<{ x: number; y: number }[]>([])
    const arrowStart = useRef<{ x: number; y: number } | null>(null)

    // ── Load screenshot image ──────────────────────────────────────────────────
    useEffect(() => {
      const img = new Image()
      img.onload = () => {
        imgRef.current = img
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width  = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
      }
      img.src = screenshotDataUrl
    }, [screenshotDataUrl])

    // ── Expose getAnnotatedDataUrl ─────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getAnnotatedDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? screenshotDataUrl,
    }))

    // ── Canvas coordinate helper ───────────────────────────────────────────────
    function canvasXY(e: React.MouseEvent): { x: number; y: number } {
      const canvas = canvasRef.current!
      const rect   = canvas.getBoundingClientRect()
      const scaleX = canvas.width  / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY,
      }
    }

    // ── Redraw helper ──────────────────────────────────────────────────────────
    const redraw = useCallback((opsArr: DrawOp[], preview?: DrawOp) => {
      const canvas = canvasRef.current
      const img    = imgRef.current
      if (!canvas || !img) return
      const ctx = canvas.getContext('2d')!
      redrawAll(ctx, img, opsArr, preview)
    }, [])

    // ── Mouse events ───────────────────────────────────────────────────────────
    function onMouseDown(e: React.MouseEvent) {
      if (e.button !== 0) return
      const pos = canvasXY(e)

      if (tool === 'text') {
        setTextInput(pos)
        setTextValue('')
        setTimeout(() => textInputRef.current?.focus(), 50)
        return
      }

      drawing.current = true
      if (tool === 'pen') {
        currentPen.current = [pos]
      } else if (tool === 'arrow') {
        arrowStart.current = pos
      }
    }

    function onMouseMove(e: React.MouseEvent) {
      if (!drawing.current) return
      const pos = canvasXY(e)
      setMouse(pos)

      if (tool === 'pen') {
        currentPen.current.push(pos)
        redraw(ops, {
          type: 'pen', points: [...currentPen.current], color, width,
        } satisfies PenOp)
      } else if (tool === 'arrow' && arrowStart.current) {
        redraw(ops, {
          type: 'arrow',
          x1: arrowStart.current.x, y1: arrowStart.current.y,
          x2: pos.x, y2: pos.y,
          color, width,
        } satisfies ArrowOp)
      }
    }

    function onMouseUp(e: React.MouseEvent) {
      if (!drawing.current) return
      drawing.current = false
      const pos = canvasXY(e)

      if (tool === 'pen' && currentPen.current.length >= 2) {
        const newOp: PenOp = { type: 'pen', points: [...currentPen.current], color, width }
        const next = [...ops, newOp]
        setOps(next)
        redraw(next)
        currentPen.current = []
      } else if (tool === 'arrow' && arrowStart.current) {
        const newOp: ArrowOp = {
          type: 'arrow',
          x1: arrowStart.current.x, y1: arrowStart.current.y,
          x2: pos.x, y2: pos.y,
          color, width,
        }
        const next = [...ops, newOp]
        setOps(next)
        redraw(next)
        arrowStart.current = null
      }
    }

    // ── Text commit ────────────────────────────────────────────────────────────
    function commitText() {
      if (!textInput || !textValue.trim()) {
        setTextInput(null)
        return
      }
      const newOp: TextOp = {
        type: 'text', x: textInput.x, y: textInput.y,
        text: textValue.trim(), color, size: Math.max(16, width * 5),
      }
      const next = [...ops, newOp]
      setOps(next)
      redraw(next)
      setTextInput(null)
      setTextValue('')
    }

    // ── Undo ───────────────────────────────────────────────────────────────────
    function undo() {
      const next = ops.slice(0, -1)
      setOps(next)
      redraw(next)
    }

    function clear() {
      setOps([])
      redraw([])
    }

    // ── Canvas rect (for text input positioning) ───────────────────────────────
    const canvasEl   = canvasRef.current
    const canvasRect = canvasEl?.getBoundingClientRect()
    const scaleX     = canvasEl ? canvasEl.width  / (canvasRect?.width  ?? 1) : 1
    const scaleY     = canvasEl ? canvasEl.height / (canvasRect?.height ?? 1) : 1

    return (
      <div className="flex flex-col gap-2">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tools */}
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            {([
              { id: 'pen',   Icon: Pencil,   label: 'Pen'   },
              { id: 'text',  Icon: Type,     label: 'Text'  },
              { id: 'arrow', Icon: MoveRight, label: 'Arrow' },
            ] as const).map(({ id, Icon, label }) => (
              <Button
                key={id}
                variant={tool === id ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setTool(id)}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>

          {/* Colours */}
          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                title={c}
                onClick={() => setColor(c)}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-transform',
                  color === c ? 'border-foreground scale-125' : 'border-border',
                )}
                style={{ background: c }}
              />
            ))}
          </div>

          {/* Width */}
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            {WIDTHS.map(w => (
              <button
                key={w}
                title={`Stroke ${w}`}
                onClick={() => setWidth(w)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center rounded transition-colors',
                  width === w ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: Math.min(w * 2.5, 14), height: Math.min(w * 2.5, 14) }}
                />
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Undo / Clear */}
          <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" onClick={undo} disabled={ops.length === 0} title="Undo">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-destructive hover:text-destructive" onClick={clear} disabled={ops.length === 0} title="Clear all">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>

        {/* Canvas area */}
        <div className="relative border rounded-md overflow-hidden bg-checkerboard" style={{ maxHeight: 400, overflowY: 'auto' }}>
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              maxWidth: '100%',
              cursor: tool === 'text' ? 'text' : 'crosshair',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          />

          {/* Floating text input */}
          {textInput && canvasRect && (
            <input
              ref={textInputRef}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null) }}
              onBlur={commitText}
              className="absolute border border-dashed border-blue-400 bg-black/60 text-white px-1 outline-none text-sm font-bold"
              style={{
                left:  (textInput.x / scaleX),
                top:   (textInput.y / scaleY),
                minWidth: 80,
                color,
                fontSize: Math.max(14, width * 4),
              }}
            />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {tool === 'text' ? 'Click on the image to place text, then press Enter' :
           tool === 'pen'  ? 'Click and drag to draw freehand' :
           'Click and drag to draw an arrow'}
        </p>
      </div>
    )
  },
)

AnnotationCanvas.displayName = 'AnnotationCanvas'

export default AnnotationCanvas
