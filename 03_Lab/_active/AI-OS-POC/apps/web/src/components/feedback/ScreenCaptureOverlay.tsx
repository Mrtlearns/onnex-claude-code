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
