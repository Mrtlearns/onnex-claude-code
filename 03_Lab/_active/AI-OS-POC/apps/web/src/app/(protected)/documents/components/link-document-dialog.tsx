"use client"
// apps/web/src/app/(protected)/documents/components/link-document-dialog.tsx
// Dialog with Paperless + Nextcloud tabs to link a document to a client/project/deal

import { useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { PaperlessBrowser } from "./paperless-browser"
import { NextcloudBrowser } from "./nextcloud-browser"
import type { DocumentEntityType, DocumentSource, PaperlessDocument, NextcloudFile } from "@/types/api"

interface LinkDocumentDialogProps {
  entityType: DocumentEntityType
  entityId: string
  open: boolean
  onClose: () => void
  onLink?: (source: string, documentId: string, linkType?: 'file' | 'folder', displayName?: string) => Promise<boolean>
}

export function LinkDocumentDialog({
  entityType,
  entityId,
  open,
  onClose,
  onLink,
}: LinkDocumentDialogProps) {
  const queryClient = useQueryClient()

  const linkDoc = async (
    documentSource: DocumentSource,
    documentId: string,
    linkType: 'file' | 'folder' = 'file',
    displayName?: string,
  ) => {
    try {
      if (onLink) {
        const ok = await onLink(documentSource, documentId, linkType, displayName)
        if (ok) onClose()
        return
      }

      const res = await fetch("/api/bff/documents/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_source: documentSource,
          document_id: documentId,
          entity_type: entityType,
          entity_id: entityId,
          link_type: linkType,
          display_name: displayName,
        }),
      })

      if (res.ok) {
        toast.success("Document linked successfully")
        queryClient.invalidateQueries({ queryKey: ["document-links"] })
        onClose()
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Failed to link document")
      }
    } catch {
      toast.error("Failed to link document")
    }
  }

  const handlePaperlessSelect = async (doc: PaperlessDocument) => {
    await linkDoc("paperless", String(doc.id), "file", doc.title ?? undefined)
  }

  const handleNextcloudSelect = async (file: NextcloudFile) => {
    await linkDoc("nextcloud", file.path, "file", file.name)
  }

  const handleNextcloudFolderSelect = async (path: string, name: string) => {
    await linkDoc("nextcloud", path, "folder", name)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Document</DialogTitle>
          <DialogDescription>
            Select a document from Paperless-ngx or Nextcloud to link to this {entityType}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paperless" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="paperless" className="flex-1">Paperless-ngx</TabsTrigger>
            <TabsTrigger value="nextcloud" className="flex-1">Nextcloud</TabsTrigger>
          </TabsList>

          <TabsContent value="paperless" className="flex-1 overflow-auto mt-2">
            <PaperlessBrowser onSelect={handlePaperlessSelect} />
          </TabsContent>

          <TabsContent value="nextcloud" className="flex-1 overflow-auto mt-2">
            <NextcloudBrowser
              onSelectFile={handleNextcloudSelect}
              onSelectFolder={handleNextcloudFolderSelect}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
