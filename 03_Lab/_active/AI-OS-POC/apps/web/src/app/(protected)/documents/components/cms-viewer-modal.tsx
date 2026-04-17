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
import { Maximize2, Minimize2, Share2, ExternalLink } from "lucide-react"
import { DocumentViewer } from "./document-viewer"
import { NextcloudBrowser } from "./nextcloud-browser"
import { DocumentComments } from "./document-comments"

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
          <div className="flex-1 overflow-auto">
            <NextcloudBrowser />
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
