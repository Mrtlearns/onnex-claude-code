"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TaskComment } from "@/types/api"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function CommentsPanel({ taskId }: { taskId: string }) {
  const qc = useQueryClient()
  const [body, setBody] = useState("")

  const { data: raw, isLoading } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () =>
      fetch(`/api/bff/tasks/${taskId}/comments`).then(r => r.json()),
    staleTime: 30_000,
  })
  const comments: TaskComment[] = Array.isArray(raw) ? raw : []

  const { mutate: addComment, isPending } = useMutation({
    mutationFn: async (commentBody: string) =>
      fetch(`/api/bff/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      }).then(r => r.json()),
    onSuccess: () => {
      setBody("")
      qc.invalidateQueries({ queryKey: ["comments", taskId] })
    },
  })

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Comments ({comments.length})</h4>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-2">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {comment.author_id.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{comment.author_id.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                </div>
                <p className="text-sm mt-0.5">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={body}
          onChange={e => setBody(e.target.value)}
          className="text-sm min-h-[80px]"
          disabled={isPending}
        />
        <Button
          size="sm"
          onClick={() => body.trim() && addComment(body.trim())}
          disabled={isPending || !body.trim()}
        >
          Add Comment
        </Button>
      </div>
    </div>
  )
}
