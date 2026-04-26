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
