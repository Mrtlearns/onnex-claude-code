'use client'

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent, DragEvent } from 'react'
import { useUniverseStore } from '@/store/universe'

interface ArtifactInputProps {
  nodeId: string
}

type InputMode = 'note' | 'url' | 'voice'

function isUrl(s: string): boolean {
  return /^https?:\/\/.+/i.test(s.trim())
}

export default function ArtifactInput({ nodeId }: ArtifactInputProps) {
  const { addArtifact } = useUniverseStore()
  const [mode, setMode] = useState<InputMode>('note')
  const [text, setText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [urlLabel, setUrlLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Voice recording state
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [pendingVoice, setPendingVoice] = useState<{ blob: Blob; ext: string; durationSec: number } | null>(null)
  const [voiceName, setVoiceName] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordSecondsRef = useRef(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Note / text ────────────────────────────────────────────────────────────
  async function submitText() {
    const trimmed = text.trim()
    if (!trimmed || uploading) return

    // Auto-detect URL
    if (isUrl(trimmed)) {
      await submitUrl(trimmed, '')
      setText('')
      return
    }

    setUploading(true)
    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId, content: trimmed }),
      })
      if (res.ok) {
        const artifact = await res.json()
        addArtifact(artifact)
        setText('')
        textareaRef.current?.focus()
      }
    } catch (err) {
      console.error('Submit text error:', err)
    } finally {
      setUploading(false)
    }
  }

  // ── URL ───────────────────────────────────────────────────────────────────
  async function submitUrl(url: string, label: string) {
    let trimUrl = url.trim()
    if (!trimUrl || uploading) return
    if (!/^https?:\/\//i.test(trimUrl)) trimUrl = 'https://' + trimUrl
    try { new URL(trimUrl) } catch { return }

    setUploading(true)
    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: nodeId,
          artifact_type: 'url',
          content: trimUrl,
          filename: label.trim() || null,
        }),
      })
      if (res.ok) {
        const artifact = await res.json()
        addArtifact(artifact)
        setUrlValue('')
        setUrlLabel('')
      }
    } catch (err) {
      console.error('Submit URL error:', err)
    } finally {
      setUploading(false)
    }
  }

  // ── File / image ───────────────────────────────────────────────────────────
  async function uploadFile(file: File, artifactType: 'image' | 'file') {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('node_id', nodeId)
      fd.append('file', file)
      fd.append('artifact_type', artifactType)
      const res = await fetch('/api/attachments', { method: 'POST', body: fd })
      if (res.ok) {
        const artifact = await res.json()
        addArtifact(artifact)
      }
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const ext = (mr.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm'
        setPendingVoice({ blob, ext, durationSec: recordSecondsRef.current })
        setRecording(false)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      }

      mr.start()
      setRecording(true)
      setRecordSeconds(0)
      recordSecondsRef.current = 0
      timerRef.current = setInterval(() => {
        recordSecondsRef.current += 1
        setRecordSeconds((s) => s + 1)
      }, 1000)
    } catch (err) {
      console.error('Mic access denied:', err)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  async function uploadVoice() {
    if (!pendingVoice || uploading) return
    const name = voiceName.trim() || `recording-${new Date().toISOString().slice(0, 19).replace('T', '_')}`
    const file = new File([pendingVoice.blob], `${name}.${pendingVoice.ext}`, { type: pendingVoice.blob.type })
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('node_id', nodeId)
      fd.append('file', file)
      fd.append('artifact_type', 'voice')
      const res = await fetch('/api/attachments', { method: 'POST', body: fd })
      if (res.ok) {
        addArtifact(await res.json())
        setPendingVoice(null)
        setVoiceName('')
        setRecordSeconds(0)
      }
    } catch (err) {
      console.error('Voice upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  // ── Paste / drag handlers ─────────────────────────────────────────────────
  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) uploadFile(new File([file], `paste-${Date.now()}.png`, { type: file.type }), 'image')
      return
    }
    // If clipboard text is a URL, switch to URL mode
    const textItem = items.find((item) => item.kind === 'string' && item.type === 'text/plain')
    if (textItem) {
      textItem.getAsString((s) => {
        if (isUrl(s)) {
          e.preventDefault()
          setMode('url')
          setUrlValue(s.trim())
        }
      })
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submitText()
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setIsDragOver(true) }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setIsDragOver(false) }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    uploadFile(file, file.type.startsWith('image/') ? 'image' : 'file')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadFile(file, file.type.startsWith('image/') ? 'image' : 'file')
    e.target.value = ''
  }

  const tabClass = (m: InputMode) =>
    `px-2.5 py-1 text-xs rounded-md transition-all ${mode === m
      ? 'bg-white/15 text-white font-medium'
      : 'text-white/35 hover:text-white/60'}`

  return (
    <div
      className="flex-shrink-0 p-3 border-t border-white/10"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Mode tabs */}
      <div className="flex gap-1 mb-2">
        <button className={tabClass('note')} onClick={() => setMode('note')}>📝 Note</button>
        <button className={tabClass('url')} onClick={() => setMode('url')}>🔗 URL</button>
        <button className={tabClass('voice')} onClick={() => setMode('voice')}>🎙️ Voice</button>
      </div>

      {/* ── Note mode ── */}
      {mode === 'note' && (
        <div
          className="flex gap-2 rounded-xl p-2 transition-all"
          style={{
            background: isDragOver ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
            border: isDragOver ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="Type a note, paste or drop images/files… (⌘Enter to send)"
            rows={2}
            disabled={uploading}
            className="flex-1 bg-transparent text-sm text-white/85 placeholder-white/25
                       outline-none resize-none leading-relaxed"
          />
          <div className="flex flex-col gap-1.5 justify-end flex-shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach file"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                         text-white/40 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-40"
            >
              📎
            </button>
            <button
              onClick={submitText}
              disabled={!text.trim() || uploading}
              title="Send (⌘Enter)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                         bg-blue-500/70 hover:bg-blue-500/90 text-white transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {uploading ? '⏳' : '↑'}
            </button>
          </div>
        </div>
      )}

      {/* ── URL mode ── */}
      {mode === 'url' && (
        <div className="space-y-2">
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://..."
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-white/08 border border-white/15
                       text-white placeholder-white/25 text-sm outline-none focus:border-blue-400/50 transition-all"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={urlLabel}
              onChange={(e) => setUrlLabel(e.target.value)}
              placeholder="Label / note (optional)"
              className="flex-1 px-3 py-2 rounded-lg text-white placeholder-white/25 text-sm outline-none focus:border-blue-400/50 transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            <button
              onClick={() => submitUrl(urlValue, urlLabel)}
              disabled={!urlValue.trim() || uploading}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'rgba(59,130,246,0.6)', color: 'white' }}
            >
              {uploading ? '⏳' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* ── Voice mode ── */}
      {mode === 'voice' && (
        <div className="space-y-2 py-1">
          <div className="flex items-center gap-3">
            {!recording && !pendingVoice ? (
              <button
                onClick={startRecording}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
              >
                🎙️ Start Recording
              </button>
            ) : recording ? (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(239,68,68,0.5)', border: '1px solid rgba(239,68,68,0.7)', color: 'white' }}
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Stop — {recordSeconds}s
              </button>
            ) : null}
            {uploading && <span className="text-xs text-white/40">Uploading…</span>}
          </div>

          {pendingVoice && !recording && (
            <div className="space-y-2">
              <div className="text-sm text-white/50">🎙️ {pendingVoice.durationSec}s recorded</div>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/30 outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={uploadVoice}
                  disabled={uploading}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                  style={{ background: 'rgba(59,130,246,0.6)', color: 'white' }}
                >
                  {uploading ? '⏳' : 'Add'}
                </button>
                <button
                  onClick={() => { setPendingVoice(null); setVoiceName(''); setRecordSeconds(0) }}
                  className="py-2 px-3 rounded-lg text-sm text-white/40 hover:text-white/70 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} disabled={uploading} />
    </div>
  )
}
