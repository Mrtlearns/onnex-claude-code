"use client"
// apps/web/src/app/(protected)/documents/components/cms-section.tsx
// Shared CMS panel — shows document links for any entity, opens viewer modal on click

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FolderIcon, FileIcon, Trash2, Link2 } from "lucide-react"
import { toast } from "sonner"
import { LinkDocumentDialog } from "./link-document-dialog"
import { CmsViewerModal } from "./cms-viewer-modal"
import { useLinkDocument } from "@/hooks/use-link-document"
import type { DocumentEntityType, DocumentLink } from "@/types/api"

interface CmsSectionProps {
  entityType: DocumentEntityType
  entityId: string
  projectId?: string  // required when entityType="task"
  title?: string
}

interface ViewerState {
  open: boolean
  mode: "file" | "folder"
  title: string
  nextcloudPath?: string
  paperlessId?: number
  folderPath?: string
  documentSource?: string
  documentId?: string
}

export function CmsSection({ entityType, entityId, projectId, title = "Files" }: CmsSectionProps) {
  const queryClient = useQueryClient()
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [viewer, setViewer] = useState<ViewerState>({ open: false, mode: "file", title: "" })

  const { linkDocument } = useLinkDocument({ entityType, entityId, projectId })

  const { data: links = [], isLoading } = useQuery<DocumentLink[]>({
    queryKey: ["document-links", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/bff/documents/links?entity_type=${entityType}&entity_id=${entityId}`)
      const json = await res.json()
      return (json.documentLinks ?? []) as DocumentLink[]
    },
    staleTime: 30_000,
  })

  const handleDelete = async (link: DocumentLink) => {
    const res = await fetch(`/api/bff/documents/links/${link.id}`, { method: "DELETE" })
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["document-links", entityType, entityId] })
    } else {
      toast.error("Failed to remove link")
    }
  }

  const handleClick = (link: DocumentLink) => {
    const docId = link.document_id
    const name = link.display_name ?? docId.split("/").pop() ?? docId

    if (link.document_source === "paperless") {
      setViewer({ open: true, mode: "file", title: name, paperlessId: parseInt(docId, 10), documentSource: "paperless", documentId: docId })
    } else if (link.link_type === "folder") {
      setViewer({ open: true, mode: "folder", title: name, folderPath: docId, documentSource: "nextcloud", documentId: docId })
    } else {
      setViewer({ open: true, mode: "file", title: name, nextcloudPath: docId, documentSource: "nextcloud", documentId: docId })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{title}</span>
            <Button size="sm" variant="outline" onClick={() => setLinkDialogOpen(true)}>
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Link
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          )}
          {!isLoading && links.length === 0 && (
            <p className="text-sm text-muted-foreground">No files linked yet.</p>
          )}
          {!isLoading && links.length > 0 && (
            <div className="space-y-1">
              {links.map((link) => {
                const docId = link.document_id
                const name = link.display_name ?? docId.split("/").pop() ?? docId
                const folder = link.link_type === "folder"

                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 rounded-md hover:bg-muted/50 px-2 py-1.5 group"
                  >
                    <button
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      onClick={() => handleClick(link)}
                    >
                      {folder ? (
                        <FolderIcon className="h-4 w-4 text-yellow-500 shrink-0" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm truncate">{name}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => handleDelete(link)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LinkDocumentDialog
        entityType={entityType}
        entityId={entityId}
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onLink={async (source, docId, linkType, displayName) => {
          const ok = await linkDocument(source, docId, linkType, displayName)
          if (ok) toast.success("Document linked")
          return ok
        }}
      />

      <CmsViewerModal
        open={viewer.open}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
        mode={viewer.mode}
        title={viewer.title}
        nextcloudPath={viewer.nextcloudPath}
        paperlessId={viewer.paperlessId}
        folderPath={viewer.folderPath}
        entityType={entityType}
        entityId={entityId}
        documentSource={viewer.documentSource}
        documentId={viewer.documentId}
      />
    </>
  )
}
