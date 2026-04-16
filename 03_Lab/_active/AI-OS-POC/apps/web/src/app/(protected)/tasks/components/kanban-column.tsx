"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus } from "@/types/api"
import { TaskCard } from "./task-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState } from "react"
import { TaskForm } from "./task-form"

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

export function KanbanColumn({ status, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const [showForm, setShowForm] = useState(false)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-72 rounded-lg bg-muted/50 p-3",
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{status}</h3>
        <div className="flex items-center gap-1">
          <Badge variant="secondary">{tasks.length}</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      </SortableContext>
      {showForm && (
        <div className="mt-2">
          <TaskForm
            defaultStatus={status}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  )
}
