import { useEffect, useRef, useState } from 'react'
import { Paperclip, Download, FileText, Image, File, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Attachment } from './MsgUploader'

// ── MIME helpers ────────────────────────────────────────────────────────────
const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  bmp:  'image/bmp',
  svg:  'image/svg+xml',
}

function fileExt(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function mimeFor(filename: string) {
  return MIME_MAP[fileExt(filename)] ?? 'application/octet-stream'
}

function isImage(filename: string) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt(filename))
}

function isPdf(filename: string) {
  return fileExt(filename) === 'pdf'
}

function canPreview(filename: string) {
  return isImage(filename) || isPdf(filename)
}

// ── Component ───────────────────────────────────────────────────────────────
interface Props {
  attachments: Attachment[]
}

export default function AttachmentPreview({ attachments }: Props) {
  const [selected, setSelected]   = useState<Attachment | null>(null)
  const [blobUrl, setBlobUrl]     = useState<string | null>(null)
  const [fetching, setFetching]   = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const prevBlob = useRef<string | null>(null)

  // Auto-select first non-filtered attachment whenever the list changes
  useEffect(() => {
    const active = attachments.find(a => !a.filtered) ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
    setSelected(active)
  }, [attachments])

  // Fetch blob when selection changes
  useEffect(() => {
    if (prevBlob.current) { URL.revokeObjectURL(prevBlob.current); prevBlob.current = null }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
    setBlobUrl(null)
    setFetchError(null)

    if (!selected || !canPreview(selected.filename)) return

    setFetching(true)
    fetch(selected.downloadUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob() })
      .then(blob => {
        const typed = new Blob([blob], { type: mimeFor(selected.filename) })
        const url   = URL.createObjectURL(typed)
        prevBlob.current = url
        setBlobUrl(url)
      })
      .catch(e => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setFetching(false))
  }, [selected])

  // Revoke blob on unmount
  useEffect(() => () => { if (prevBlob.current) URL.revokeObjectURL(prevBlob.current) }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Attachment Preview
          {attachments.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({attachments.length} file{attachments.length !== 1 ? 's' : ''})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 min-h-0">

        {/* ── Empty state ── */}
        {attachments.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 py-14 text-muted-foreground">
            <Paperclip className="h-8 w-8 opacity-25" />
            <p className="text-sm">Extract a .msg file to preview attachments</p>
          </div>
        )}

        {attachments.length > 0 && (
          <>
            {/* ── File list ── */}
            <div className="space-y-1">
              {attachments.map((att, i) => {
                if (att.filtered) {
                  return (
                    <div
                      key={i}
                      title={att.filterReason}
                      className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm opacity-40 cursor-default"
                    >
                      <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate font-mono text-xs line-through text-muted-foreground">{att.filename}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 font-medium">
                        Ignored
                      </span>
                    </div>
                  )
                }
                const active = selected?.downloadUrl === att.downloadUrl
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(att)}
                    className={[
                      'w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    ].join(' ')}
                  >
                    {isPdf(att.filename)
                      ? <FileText className="h-3.5 w-3.5 shrink-0" />
                      : isImage(att.filename)
                        ? <Image className="h-3.5 w-3.5 shrink-0" />
                        : <File className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span className="flex-1 truncate font-mono text-xs">{att.filename}</span>
                    <span className={`text-xs shrink-0 ${active ? 'opacity-70' : 'text-muted-foreground'}`}>
                      {att.size_kb} KB
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ── Preview pane ── */}
            <div className="flex-1 rounded-md border bg-muted/20 overflow-hidden min-h-[260px] flex flex-col items-center justify-center">

              {/* Loading */}
              {fetching && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-xs">Loading preview…</p>
                </div>
              )}

              {/* Error */}
              {!fetching && fetchError && (
                <p className="text-xs text-destructive px-4 text-center">
                  Could not load preview: {fetchError}
                </p>
              )}

              {/* PDF */}
              {!fetching && !fetchError && blobUrl && selected && isPdf(selected.filename) && (
                <iframe
                  src={blobUrl}
                  title={selected.filename}
                  className="w-full border-0"
                  style={{ height: 340 }}
                />
              )}

              {/* Image */}
              {!fetching && !fetchError && blobUrl && selected && isImage(selected.filename) && (
                <img
                  src={blobUrl}
                  alt={selected.filename}
                  className="max-w-full object-contain p-3"
                  style={{ maxHeight: 320 }}
                />
              )}

              {/* No preview available */}
              {!fetching && !fetchError && !blobUrl && selected && !canPreview(selected.filename) && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <File className="h-8 w-8 opacity-25" />
                  <div className="text-center px-4">
                    <p className="text-xs">No preview for this file type</p>
                    <p className="text-xs font-mono mt-0.5 opacity-70">{selected.filename}</p>
                  </div>
                  <a href={selected.downloadUrl} download={selected.filename}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
