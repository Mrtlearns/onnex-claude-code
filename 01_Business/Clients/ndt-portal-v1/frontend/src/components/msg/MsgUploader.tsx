import { useRef, useState } from 'react'
import { Upload, Paperclip, Download, AlertCircle, CheckCircle2, X, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ── Types ──────────────────────────────────────────────────────────────────
interface EmailData {
  from: string
  to: string
  subject: string
  date: string
  body: string
}

export interface Attachment {
  filename: string
  size: number
  size_kb: number
  downloadUrl: string
  filtered?: boolean
  filterReason?: string
}

export interface MsgExtractResult {
  success: boolean
  error?: string
  email?: EmailData
  attachments?: Attachment[]
  attachmentCount?: number
  extractedAt?: string
}

interface Props {
  /** Base URL of the msg-api server. Default: /api/msg (proxied through Traefik) */
  apiUrl?: string
  /** Called after a successful extraction */
  onExtract?: (result: MsgExtractResult) => void
}

// ── Component ──────────────────────────────────────────────────────────────
export default function MsgUploader({ apiUrl = '/api/msg', onExtract }: Props) {
  const [result, setResult]       = useState<MsgExtractResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Upload handler ───────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.msg')) {
      setError('Please select a .msg (Outlook) file')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    const body = new FormData()
    body.append('file', file)

    const attemptUpload = async (attemptsLeft: number): Promise<void> => {
      try {
        const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', body })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || `Server error ${res.status}`)
        }
        const data: MsgExtractResult = await res.json()
        setResult(data)
        if (!data.success) setError(data.error ?? 'Extraction failed')
        else onExtract?.(data)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        const isNetworkError = msg === 'Failed to fetch' || msg === 'NetworkError when attempting to fetch resource.'
        if (isNetworkError && attemptsLeft > 0) {
          await new Promise(r => setTimeout(r, 1500))
          return attemptUpload(attemptsLeft - 1)
        }
        setError(isNetworkError ? 'Upload failed — service unreachable. Please try again.' : msg)
      }
    }

    try {
      await attemptUpload(1)
    } finally {
      setLoading(false)
    }
  }

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const reset = () => {
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Drop zone ────────────────────────────────────────────────────────────
  const dropZone = (
    <div
      onClick={() => !loading && fileRef.current?.click()}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDragOver={onDrag}
      onDrop={onDrop}
      className={[
        'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed',
        'p-8 text-center cursor-pointer transition-colors select-none',
        dragActive
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30',
        loading ? 'pointer-events-none opacity-70' : '',
      ].join(' ')}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".msg"
        className="sr-only"
        onChange={onInputChange}
        disabled={loading}
      />
      {loading ? (
        <>
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Extracting email…</p>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop .msg file here or click to browse</p>
          <p className="text-xs text-muted-foreground">Microsoft Outlook messages (.msg)</p>
        </>
      )}
    </div>
  )

  // ── Error banner ─────────────────────────────────────────────────────────
  const errorBanner = error && (
    <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Error</p>
        <p className="text-xs mt-0.5 opacity-90">{error}</p>
      </div>
    </div>
  )

  // ── Extracted email view ──────────────────────────────────────────────────
  const emailView = result?.success && result.email && (
    <div className="space-y-3">
      {/* Email header */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0 pt-0.5">From</span>
          <span className="break-all">{result.email.from}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0 pt-0.5">To</span>
          <span className="break-all">{result.email.to}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0 pt-0.5">Subject</span>
          <span className="font-medium">{result.email.subject}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0 pt-0.5">Date</span>
          <span className="text-muted-foreground text-xs">
            {result.email.date ? new Date(result.email.date).toLocaleString() : '—'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Message</p>
        <pre className="text-xs bg-muted/30 border rounded-md p-3 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
          {result.email.body || '(no body)'}
        </pre>
      </div>

      {/* Attachments */}
      {result.attachments && result.attachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Attachments ({result.attachmentCount})
          </p>
          <div className="space-y-1">
            {result.attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{att.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0">{att.size_kb} KB</span>
                <a
                  href={att.downloadUrl}
                  download={att.filename}
                  className="shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success note */}
      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Email extracted successfully
        {(result.attachmentCount ?? 0) > 0 && ` • ${result.attachmentCount} attachment${result.attachmentCount! > 1 ? 's' : ''} ready`}
      </div>
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-amber-500" />
          Email Intake (.msg)
        </CardTitle>
        {result && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={reset}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && dropZone}
        {errorBanner}
        {emailView}
      </CardContent>
    </Card>
  )
}
