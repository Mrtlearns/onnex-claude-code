// Type-aware document viewer — renders PDF/image (iframe), Office (Collabora PDF), text (inline), other (download link)

import { useState, useEffect, useRef } from 'react'
import { ExternalLink, Share2 } from 'lucide-react'
import { documentsApi } from '@/lib/documentsApi'
import type { NextcloudFile } from './NextcloudBrowser'

const OFFICE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']
const IMAGE_EXTENSIONS  = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
const TEXT_EXTENSIONS   = ['txt', 'md', 'csv', 'json', 'xml', 'log']

function getFileType(filename: string): 'pdf' | 'office' | 'image' | 'text' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf')                        return 'pdf'
  if (OFFICE_EXTENSIONS.includes(ext))      return 'office'
  if (IMAGE_EXTENSIONS.includes(ext))       return 'image'
  if (TEXT_EXTENSIONS.includes(ext))        return 'text'
  return 'other'
}

function TextPreview({ path }: { path: string }) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    setText(null)
    documentsApi.download(path)
      .then(r => r.text())
      .then(setText)
      .catch(() => setText('Could not load file content.'))
  }, [path])

  if (text === null) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  return (
    <pre className="overflow-auto p-4 text-sm whitespace-pre-wrap break-words h-full">
      {text}
    </pre>
  )
}

// Fetch a file with auth headers and return a blob URL safe for iframe use
function useAuthenticatedBlobUrl(
  path: string | null,
  fetcher: (p: string) => Promise<Response>,
): { blobUrl: string | null; loading: boolean; error: string | null } {
  const [blobUrl, setBlobUrl]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const prevUrl                 = useRef<string | null>(null)

  useEffect(() => {
    if (!path) { setBlobUrl(null); return }

    setLoading(true)
    setError(null)

    fetcher(path)
      .then(async r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        const blob = await r.blob()
        const url  = URL.createObjectURL(blob)
        // Revoke previous blob URL to avoid memory leak
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
        prevUrl.current = url
        setBlobUrl(url)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))

    return () => {
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current)
        prevUrl.current = null
      }
    }
  }, [path]) // fetcher is stable — excluded intentionally

  return { blobUrl, loading, error }
}

interface DocumentViewerProps {
  file: NextcloudFile | null
}

export default function DocumentViewer({ file }: DocumentViewerProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing]   = useState(false)

  useEffect(() => { setShareUrl(null) }, [file?.path])

  const fileName = file ? (file.path.split('/').pop() ?? file.name) : ''
  const fileType = file ? getFileType(fileName) : 'other'

  // Pick the right fetcher based on file type
  const blobPath = file?.path ?? null
  const fetcher  = fileType === 'office'
    ? (p: string) => documentsApi.convertToPdf(p)
    : (p: string) => documentsApi.download(p)

  const { blobUrl, loading, error } = useAuthenticatedBlobUrl(
    fileType === 'text' || fileType === 'other' ? null : blobPath,
    fetcher,
  )

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground rounded border border-dashed">
        Select a document to preview
      </div>
    )
  }

  const downloadUrl = `/api/documents/${file.path}?download=1`

  async function createShare() {
    setSharing(true)
    try {
      const data = await documentsApi.shareLink(file!.path)
      if (data.url) {
        setShareUrl(data.url)
        navigator.clipboard.writeText(data.url).catch(() => {})
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex flex-col h-full rounded border overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <span className="text-sm font-medium truncate flex-1">{fileName}</span>
        {shareUrl && (
          <span className="text-xs text-muted-foreground" title={shareUrl}>
            Link copied
          </span>
        )}
        <button
          onClick={createShare}
          disabled={sharing}
          title="Copy share link"
          className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => window.open(downloadUrl, '_blank')}
          title="Open in new tab"
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-destructive text-sm">
            {error}
          </div>
        )}
        {!loading && !error && (
          <>
            {(fileType === 'pdf' || fileType === 'image' || fileType === 'office') && blobUrl ? (
              <iframe src={blobUrl} className="w-full h-full border-0" title={fileName} />
            ) : fileType === 'text' ? (
              <TextPreview path={file.path} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <p className="text-sm">No preview available for this file type</p>
                <a href={downloadUrl} download className="underline text-sm">
                  Download file
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
