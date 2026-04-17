"use client"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { DocumentEntityType } from "@/types/api"

interface UseLinkDocumentOptions {
  entityType: DocumentEntityType
  entityId: string
  projectId?: string  // for task→project dual-write
}

export function useLinkDocument({ entityType, entityId, projectId }: UseLinkDocumentOptions) {
  const queryClient = useQueryClient()

  const linkDocument = async (
    documentSource: string,
    documentId: string,
    linkType: 'file' | 'folder' = 'file',
    displayName?: string,
  ): Promise<boolean> => {
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
    if (!res.ok) { toast.error("Failed to link document"); return false }

    // Dual-write: task links also appear in parent project
    if (entityType === "task" && projectId) {
      const checkRes = await fetch(`/api/bff/documents/links?entity_type=project&entity_id=${projectId}`)
      if (checkRes.ok) {
        const { documentLinks = [] } = await checkRes.json()
        if (!documentLinks.some((l: { document_source: string; document_id: string }) =>
          l.document_source === documentSource && l.document_id === documentId
        )) {
          await fetch("/api/bff/documents/links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              document_source: documentSource,
              document_id: documentId,
              entity_type: "project",
              entity_id: projectId,
              link_type: linkType,
              display_name: displayName,
            }),
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ["document-links", "project", projectId] })
    }
    queryClient.invalidateQueries({ queryKey: ["document-links", entityType, entityId] })
    return true
  }

  return { linkDocument }
}
