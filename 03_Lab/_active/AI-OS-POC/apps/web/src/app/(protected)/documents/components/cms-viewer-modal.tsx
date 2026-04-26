"use client"
// apps/web/src/app/(protected)/documents/components/cms-viewer-modal.tsx
// Modal for viewing linked files (iframe) or browsing linked folders (NextcloudBrowser)

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Maximize2, Minimize2, Share2, ExternalLink, Upload, FolderPlus, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { DocumentViewer } from "./document-viewer"
import { NextcloudBrowser } from "./nextcloud-browser"
import { DocumentComments } from "./document-comments"

interface UploadItem {
  name: string
  status: "uploading" | "done" | "error"
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/")
}

interface CmsViewerModalProps {
  open: boolean
  onClose: () => void
  mode: "file" | "folder"
  title: string
  nextcloudPath?: string
  paperlessId?: number
  folderPath?: string
  entityType?: string
  entityId?: string
  documentSource?: string
  documentId?: string
}

function FolderBrowser({ folderPath, onClose }: { folderPath: string; onClose: () => void }) {
  const [currentNcPath, setCurrentNcPath] = useState(folderPath)
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: Array<{ file: File; relativePath: string }>) {
    setUploads(files.map((f) => ({ name: f.relativePath, status: "uploading" })))
    const base = currentNcPath ? currentNcPath + "/" : ""
    await Promise.all(
      files.map(async ({ file, relativePath }, i) => {
        try {
          const res = await fetch(`/api/bff/nextcloud/${encodePath(base + relativePath)}`, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream", "x-file-last-modified": String(file.lastModified) },
            body: file,
          })
          setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: res.ok ? "done" : "error" } : u)))
        } catch {
          setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: "error" } : u)))
        }
      }),
    )
    setRefreshKey((k) => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const collected: Array<{ file: File; relativePath: string }> = []
    for (const item of Array.from(e.dataTransfer.items)) {
      const entry = item.webkitGetAsEntry()
      if (entry?.isFile) {
        const file = await new Promise<File>((r) => (entry as FileSystemFileEntry).file(r))
        collected.push({ file, relativePath: file.name })
      }
    }
    if (collected.length) await uploadFiles(collected)
  }

  async function handleNewFolder() {
    const name = window.prompt("Folder name:")
    if (!name?.trim()) return
    await fetch(`/api/bff/nextcloud/mkdir/${encodePath([currentNcPath, name.trim()].filter(Boolean).join("/"))}`, { method: "POST" })
    setRefreshKey((k) => k + 1)
  }

  return (
    <div
      className={cn("flex-1 overflow-hidden flex flex-col border rounded-lg transition-colors", dragOver && "border-primary bg-primary/5")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header with icon-only toolbar */}
      <div className="px-3 py-2 border-b flex items-center gap-1.5 shrink-0">
        <span className="text-sm font-semibold flex-1 text-foreground/80">Files</span>
        <button
          title="Upload files"
          className="p-1 rounded hover:bg-muted/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          title="New folder"
          className="p-1 rounded hover:bg-muted/50 transition-colors"
          onClick={handleNewFolder}
        >
          <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="px-2 py-1 border-b space-y-0.5 shrink-0">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              {u.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
              {u.status === "done" && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
              {u.status === "error" && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
              <span className="truncate text-muted-foreground">{u.name.split("/").pop()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <NextcloudBrowser
          initialPath={folderPath}
          refreshKey={refreshKey}
          onPathChange={setCurrentNcPath}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length)
            uploadFiles(Array.from(e.target.files).map((f) => ({ file: f, relativePath: f.name })))
          e.target.value = ""
        }}
      />
    </div>
  )
}

export function CmsViewerModal({
  open,
  onClose,
  mode,
  title,
  nextcloudPath,
  paperlessId,
  folderPath,
  entityType,
  entityId,
  documentSource,
  documentId,
}: CmsViewerModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const bffUrl = nextcloudPath
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/bff/nextcloud/${encodeURIComponent(nextcloudPath)}?download=1`
    : paperlessId != null
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/bff/paperless/${paperlessId}/download`
    : null

  const handleShare = () => {
    if (!bffUrl) return
    navigator.clipboard.writeText(bffUrl).then(() => toast.success("Link copied to clipboard"))
  }

  if (mode === "folder") {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        {/* key={folderPath} forces remount when different folder is opened */}
        <DialogContent key={folderPath} className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <FolderBrowser folderPath={folderPath ?? ""} onClose={onClose} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`overflow-hidden flex flex-col transition-all duration-200 ${
          isFullscreen ? "max-w-[98vw] h-[96vh]" : "max-w-[90vw]"
        }`}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="truncate flex-1">{title}</DialogTitle>
            <div className="flex items-center gap-1 shrink-0">
              {bffUrl && (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare} title="Copy link">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(bffUrl, "_blank")} title="Open in new tab">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsFullscreen((f) => !f)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          <div className="flex-1 overflow-hidden min-h-0">
            <DocumentViewer
              documentId={paperlessId ?? null}
              title={title}
              nextcloudPath={nextcloudPath ?? null}
            />
          </div>
          {entityType && entityId && documentSource && documentId && (
            <div className="border-t pt-3 overflow-y-auto max-h-48 shrink-0">
              <DocumentComments
                documentSource={documentSource}
                documentId={documentId}
                entityType={entityType}
                entityId={entityId}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
