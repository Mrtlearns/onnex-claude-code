"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-notes.tsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, Plus, FileText } from "lucide-react"
import type { ProjectNote } from "@/types/api"

interface ProjectNotesProps {
  projectId: string
}

function formatRelative(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function ProjectNotes({ projectId }: ProjectNotesProps) {
  const qc = useQueryClient()
  const [content, setContent] = useState("")
  const [showForm, setShowForm] = useState(false)

  const { data: notes = [], isLoading } = useQuery<ProjectNote[]>({
    queryKey: ["project-notes", projectId],
    queryFn: () => fetch(`/api/bff/projects/${projectId}/notes`).then(r => r.json()),
    staleTime: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: (content: string) =>
      fetch(`/api/bff/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then(r => {
        if (!r.ok) throw new Error("Failed to save note")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-notes", projectId] })
      setContent("")
      setShowForm(false)
      toast.success("Note added")
    },
    onError: () => toast.error("Failed to save note"),
  })

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) =>
      fetch(`/api/bff/projects/${projectId}/notes/${noteId}`, { method: "DELETE" }).then(r => {
        if (!r.ok) throw new Error("Delete failed")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-notes", projectId] })
      toast.success("Note deleted")
    },
    onError: () => toast.error("Failed to delete note"),
  })

  const handleSubmit = () => {
    if (!content.trim()) return
    addMutation.mutate(content.trim())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Note
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Textarea
              placeholder="Write your note here..."
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setContent("") }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={addMutation.isPending || !content.trim()}>
                {addMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No notes yet. Click "Add Note" to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <Card key={note.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {note.author_name ? `${note.author_name} · ` : ""}{formatRelative(note.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteMutation.mutate(note.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
