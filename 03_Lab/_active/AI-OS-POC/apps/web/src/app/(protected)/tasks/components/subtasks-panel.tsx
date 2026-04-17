"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Subtask } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckSquare, Square } from "lucide-react"

export function SubtasksPanel({ taskId }: { taskId: string }) {
  const qc = useQueryClient()
  const [newTitle, setNewTitle] = useState("")

  const { data: subtasks = [], isLoading } = useQuery<Subtask[]>({
    queryKey: ["subtasks", taskId],
    queryFn: () =>
      fetch(`/api/bff/tasks/${taskId}/subtasks`).then(r => r.json()),
    staleTime: 30_000,
  })

  const { mutate: toggleSubtask } = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) =>
      fetch(`/api/bff/tasks/${taskId}/subtasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks", taskId] }),
  })

  const { mutate: addSubtask, isPending } = useMutation({
    mutationFn: async (title: string) =>
      fetch(`/api/bff/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).then(r => r.json()),
    onSuccess: () => {
      setNewTitle("")
      qc.invalidateQueries({ queryKey: ["subtasks", taskId] })
    },
  })

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && newTitle.trim()) {
      addSubtask(newTitle.trim())
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Subtasks ({subtasks.length})</h4>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
              <button
                onClick={() => toggleSubtask({ id: subtask.id, completed: !subtask.completed })}
                className="flex-shrink-0"
              >
                {subtask.completed ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <span className={"text-sm flex-1 " + (subtask.completed ? "line-through text-muted-foreground" : "")}>
                {subtask.title}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <Input
          placeholder="Add subtask... (press Enter)"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm h-8"
          disabled={isPending}
        />
        <Button
          size="sm"
          className="h-8"
          onClick={() => newTitle.trim() && addSubtask(newTitle.trim())}
          disabled={isPending || !newTitle.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  )
}
