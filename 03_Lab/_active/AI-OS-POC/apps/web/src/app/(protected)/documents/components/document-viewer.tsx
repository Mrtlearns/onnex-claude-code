"use client"
// apps/web/src/app/(protected)/documents/components/document-viewer.tsx
// Type-aware document viewer — PDF/image (iframe via BFF), Office (Collabora), text (inline), other (download)

import { useState, useEffect } from "react"
import { ExternalLink, Share2, PenLine } from "lucide-react"
import { SignRequestModal } from "./sign-request-modal"

const VIDEO_EXTENSIONS = ["mp4", "webm", "ogv", "ogg", "mov"]

const OFFICE_EXTENSIONS = [
  // Microsoft Office
  "doc", "docx", "docm", "dotx", "dotm",
  "xls", "xlsx", "xlsm", "xltx", "xltm",
  "ppt", "pptx", "pptm", "potx", "potm",
  // OpenDocument
  "odt", "ods", "odp", "odg", "odf",
  // Legacy OpenOffice / StarOffice
  "sxw", "sxc", "sxi", "sxd",
  // Other
  "rtf", "wpd",
]
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]

function getFileType(filename: string): "pdf" | "office" | "image" | "video" | "text" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "pdf") return "pdf"
  if (OFFICE_EXTENSIONS.includes(ext)) return "office"
  if (IMAGE_EXTENSIONS.includes(ext)) return "image"
  if (VIDEO_EXTENSIONS.includes(ext)) return "video"
  if (["txt", "md", "csv", "json", "xml", "log"].includes(ext)) return "text"
  return "other"
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    setText(null)
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("Could not load file content."))
  }, [url])

  if (text === null) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>
  }

  return (
    <pre className="overflow-auto p-4 text-sm whitespace-pre-wrap break-words h-full">{text}</pre>
  )
}

interface DocumentViewerProps {
  documentId: number | null
  title: string
  nextcloudPath?: string | null
}

export function DocumentViewer({ documentId, title, nextcloudPath }: DocumentViewerProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [signOpen, setSignOpen] = useState(false)

  // Reset share URL when selection changes
  useEffect(() => {
    setShareUrl(null)
  }, [nextcloudPath, documentId])

  if (nextcloudPath) {
    const fileName = nextcloudPath.split("/").pop() ?? title
    const fileType = getFileType(fileName)
    const bffUrl = `/api/bff/nextcloud/${nextcloudPath}?download=1`
    const convertUrl = `/api/bff/nextcloud/${nextcloudPath}?convert=pdf`
    const popOutUrl = fileType === "office" ? convertUrl : bffUrl

    async function createShare() {
      setSharing(true)
      try {
        const res = await fetch(`/api/bff/nextcloud/${nextcloudPath}`, { method: "POST" })
        const data = await res.json()
        if (data.url) {
          setShareUrl(data.url)
          navigator.clipboard.writeText(data.url).catch(() => {})
        }
      } finally {
        setSharing(false)
      }
    }

    const canSign = fileType === "pdf" || fileType === "office"

    return (
      <>
      <SignRequestModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        filePath={nextcloudPath}
        fileName={fileName}
      />
      <div className="flex flex-col h-[70vh] rounded border overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 shrink-0">
          <span className="text-sm font-medium truncate flex-1">{fileName}</span>
          {shareUrl && (
            <span className="text-xs text-muted-foreground" title={shareUrl}>
              Link copied
            </span>
          )}
          {canSign && (
            <button
              onClick={() => setSignOpen(true)}
              title="Send for signing"
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <PenLine className="h-4 w-4" />
            </button>
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
            onClick={() => window.open(popOutUrl, "_blank")}
            title="Open in new tab"
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-hidden">
          {fileType === "pdf" || fileType === "image" ? (
            <iframe src={bffUrl} className="w-full h-full border-0" title={fileName} />
          ) : fileType === "office" ? (
            <iframe src={convertUrl} className="w-full h-full border-0" title={fileName} />
          ) : fileType === "video" ? (
            <video
              key={bffUrl}
              controls
              className="w-full h-full bg-black"
              src={bffUrl}
            />
          ) : fileType === "text" ? (
            <TextPreview url={bffUrl} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <p className="text-sm">No preview available for this file type</p>
              <a href={bffUrl} download className="underline text-sm">
                Download file
              </a>
            </div>
          )}
        </div>
      </div>
      </>
    )
  }

  if (documentId === null) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-muted-foreground rounded border border-dashed">
        Select a document to preview
      </div>
    )
  }

  return (
    <iframe
      src={`/api/bff/paperless/${documentId}/download`}
      className="w-full h-[70vh] rounded border"
      title={title}
    />
  )
}
