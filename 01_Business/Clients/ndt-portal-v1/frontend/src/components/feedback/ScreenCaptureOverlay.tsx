import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  capturedDataUrl: string   // full-page html2canvas result
  onCapture: (croppedDataUrl: string) => void
  onCancel: () => void
}

/**
 * Full-viewport overlay rendered via Portal to document.body so it escapes
 * any ancestor stacking context (e.g. Topbar's backdrop-blur-sm).
 * Uses refs for drag state to avoid stale-closure issues with React synthetic events.
 */
function ScreenCaptureOverlayInner({ capturedDataUrl, onCapture, onCancel }: Props) {
  // Use refs for drag tracking — avoids stale closure bug with React state
  const dragging    = useRef(false)
  const dragStartPt = useRef<{ x: number; y: number } | null>(null)

  // Keep rendered selection rect in state (re-render is fine here)
  const [selRect, setSelRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  // Use window-level events so drag works even if pointer briefly leaves the div
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !dragStartPt.current) return
      const { x: x1, y: y1 } = dragStartPt.current
      const x2 = e.clientX; const y2 = e.clientY
      setSelRect({
        left:   Math.min(x1, x2),
        top:    Math.min(y1, y2),
        width:  Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      })
    }

    function onMouseUp(e: MouseEvent) {
      if (!dragging.current || !dragStartPt.current) return
      dragging.current = false

      const start = dragStartPt.current
      const x1 = Math.min(start.x, e.clientX)
      const y1 = Math.min(start.y, e.clientY)
      const w  = Math.abs(e.clientX - start.x)
      const h  = Math.abs(e.clientY - start.y)

      dragStartPt.current = null
      setSelRect(null)

      if (w < 10 || h < 10) return   // too small — ignore

      // Crop from full-page canvas
      const img = new Image()
      img.onload = () => {
        const scaleX = img.naturalWidth  / window.innerWidth
        const scaleY = img.naturalHeight / window.innerHeight

        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(w)
        canvas.height = Math.round(h)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(
          img,
          Math.round(x1 * scaleX), Math.round(y1 * scaleY),
          Math.round(w  * scaleX), Math.round(h  * scaleY),
          0, 0, Math.round(w), Math.round(h),
        )
        onCapture(canvas.toDataURL('image/png'))
      }
      img.src = capturedDataUrl
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [capturedDataUrl, onCapture])

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current    = true
    dragStartPt.current = { x: e.clientX, y: e.clientY }
    setSelRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 })
  }

  return (
    <div
      className="fixed inset-0 select-none"
      style={{ zIndex: 99999, cursor: 'crosshair' }}
      onMouseDown={onMouseDown}
    >
      {/* Screenshot as background */}
      <img
        src={capturedDataUrl}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block', objectFit: 'cover', pointerEvents: 'none' }}
      />

      {/* Dark tint */}
      <div className="absolute inset-0 bg-black/40" style={{ pointerEvents: 'none' }} />

      {/* Selection rectangle */}
      {selRect && selRect.width > 2 && selRect.height > 2 && (
        <div
          className="absolute border-2 border-blue-400"
          style={{
            left:        selRect.left,
            top:         selRect.top,
            width:       selRect.width,
            height:      selRect.height,
            pointerEvents: 'none',
            // Shadow punches a "clear" window through the dark tint
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
          }}
        />
      )}

      {/* Hint */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/70 text-white text-sm"
        style={{ pointerEvents: 'none' }}
      >
        Drag to select a region &nbsp;·&nbsp;{' '}
        <kbd className="bg-white/20 px-1 rounded">Esc</kbd> to cancel
      </div>
    </div>
  )
}

/**
 * Wraps the overlay in a Portal so it renders at document.body,
 * escaping any ancestor stacking context (backdrop-filter, transform, etc.).
 */
export default function ScreenCaptureOverlay(props: Props) {
  return createPortal(<ScreenCaptureOverlayInner {...props} />, document.body)
}
