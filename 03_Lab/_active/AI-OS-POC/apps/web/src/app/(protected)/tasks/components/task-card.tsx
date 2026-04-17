"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Task } from "@/types/api"
import { Badge } from "@/components/ui/badge"

interface TaskCardProps {
  task: Task
  onClick: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-card p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing border border-border/50 hover:border-border transition-colors"
    >
      <p className="text-sm font-medium">{task.title}</p>
      {task.due_date && (
        <p className="text-xs text-muted-foreground mt-1">Due {task.due_date}</p>
      )}
      {task.assignee_id && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">{task.assignee_id.slice(0, 8)}</Badge>
        </div>
      )}
    </div>
  )
}
