"use client"
// apps/web/src/app/(protected)/documents/components/cms-viewer-modal.tsx
// Modal for viewing linked files (iframe) or browsing linked folders (NextcloudBrowser)

import { useState } from "react"
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
  nextcloudPath?: string   // for file mode: path for BFF download
  paperlessId?: number     // for file mode: paperless doc
  folderPath?: string      // for folder mode: initial browse path
  entityType?: string
  entityId?: string
  documentSource?: string
  documentId?: string
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
  const [currentNcPath, setCurrentNcPath] = useState(folderPath ?? "")
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  async function uploadFiles(files: Array<{ file: File; relativePath: string }>) {
    const dirSet = new Set<string>()
    for (const { relativePath } of files) {
      const segments = relativePath.split("/")
      for (let i = 1; i < segments.length; i++) {
        dirSet.add([currentNcPath, ...segments.slice(0, i)].filter(Boolean).join("/"))
      }
    }
    for (const dir of dirSet) {
      await fetch(`/api/bff/nextcloud/mkdir/${encodePath(dir)}`, { method: "POST" })
    }
    setUploads(files.map((f) => ({ name: f.relativePath, status: "uploading" })))
    for (let i = 0; i < files.length; i++) {
      const { file, relativePath } = files[i]
      const uploadPath = [currentNcPath, relativePath].filter(Boolean).join("/")
      try {
        const res = await fetch(`/api/bff/nextcloud/${encodePath(uploadPath)}`, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream", "x-file-last-modified": String(file.lastModified) },
          body: file,
        })
        setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: res.ok ? "done" : "error" } : u)))
      } catch {
        setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: "error" } : u)))
      }
    }
    setRefreshKey((k) => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const entries = Array.from(e.dataTransfer.items).map((item) => item.webkitGetAsEntry()).filter(Boolean) as FileSystemEntry[]
    const collected: Array<{ file: File; relativePath: string }> = []
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((r) => (entry as FileSystemFileEntry).file(r))
        collected.push({ file, relativePath: file.name })
      }
    }
    await uploadFiles(collected)
  }

  async function handleNewFolder() {
    const name = window.prompt("Folder name:")
    if (!name?.trim()) return
    await fetch(`/api/bff/nextcloud/mkdir/${encodePath([currentNcPath, name.trim()].filter(Boolean).join("/"))}`, { method: "POST" })
    setRefreshKey((k) => k + 1)
  }

  const bffUrl = nextcloudPath
    ? `${window.location.origin}/api/bff/nextcloud/${encodeURIComponent(nextcloudPath)}?download=1`
    : paperlessId != null
    ? `${window.location.origin}/api/bff/paperless/${paperlessId}/download`
    : null

  const handleShare = () => {
    if (!bffUrl) return
    navigator.clipboard.writeText(bffUrl).then(() => {
      toast.success("Link copied to clipboard")
    })
  }

  const handlePopout = () => {
    if (!bffUrl) return
    window.open(bffUrl, "_blank")
  }

  if (mode === "folder") {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div
            className={cn("flex-1 overflow-hidden flex flex-col border rounded-lg transition-colors", dragOver && "border-primary bg-primary/5")}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {/* Upload toolbar */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30 shrink-0 flex-wrap">
              <label className="cursor-pointer">
                <input type="file" multiple className="sr-only" onChange={(e) => uploadFiles(Array.from(e.target.files ?? []).map((f) => ({ file: f, relativePath: f.name })))} />
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs pointer-events-none" asChild>
                  <span><Upload className="h-3 w-3" /> Upload</span>
                </Button>
              </label>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleNewFolder}>
                <FolderPlus className="h-3 w-3" /> New Folder
              </Button>
            </div>
            {/* Upload progress */}
            {uploads.length > 0 && (
              <div className="px-3 py-1 border-b space-y-0.5 shrink-0">
                {uploads.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {u.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
                    {u.status === "done" && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                    {u.status === "error" && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                    <span className="truncate text-muted-foreground">{u.name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-auto">
              <NextcloudBrowser
                initialPath={folderPath ?? ""}
                refreshKey={refreshKey}
                onPathChange={setCurrentNcPath}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`overflow-hidden flex flex-col transition-all duration-200 ${
          isFullscreen
            ? "max-w-[98vw] h-[96vh]"
            : "max-w-[90vw]"
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePopout} title="Open in new tab">
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
