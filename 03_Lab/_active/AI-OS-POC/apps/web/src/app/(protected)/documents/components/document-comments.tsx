"use client"
// apps/web/src/app/(protected)/documents/components/document-comments.tsx
// Collaborative comments on a specific document linked to an entity

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Trash2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import type { DocumentComment } from "@/types/api"

interface DocumentCommentsProps {
  documentSource: string
  documentId: string
  entityType: string
  entityId: string
}

function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function DocumentComments({ documentSource, documentId, entityType, entityId }: DocumentCommentsProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const queryKey = ["document-comments", documentSource, documentId, entityType, entityId]

  const { data: comments = [], isLoading } = useQuery<DocumentComment[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ document_source: documentSource, document_id: documentId, entity_type: entityType, entity_id: entityId })
      const res = await fetch(`/api/bff/documents/comments?${params}`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.comments ?? []) as DocumentComment[]
    },
    staleTime: 15_000,
  })

  const handleSubmit = async () => {
    if (!draft.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/bff/documents/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_source: documentSource, document_id: documentId, entity_type: entityType, entity_id: entityId, content: draft.trim() }),
      })
      if (!res.ok) { toast.error("Failed to post comment"); return }
      setDraft("")
      queryClient.invalidateQueries({ queryKey })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/bff/documents/comments/${id}`, { method: "DELETE" })
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey })
    } else {
      toast.error("Failed to delete comment")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        Comments
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!isLoading && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">No comments yet. Be the first.</p>
      )}

      {!isLoading && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="group flex gap-2 text-sm">
              <div className="flex-1 bg-muted/40 rounded-md px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-xs">{c.author_name || c.author_id}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed">{c.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-start mt-1"
                onClick={() => handleDelete(c.id)}
                title="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          className="text-sm min-h-[60px] resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit() }}
        />
        <Button size="sm" disabled={submitting || !draft.trim()} onClick={handleSubmit}>
          {submitting ? "…" : "Post"}
        </Button>
      </div>
    </div>
  )
}
