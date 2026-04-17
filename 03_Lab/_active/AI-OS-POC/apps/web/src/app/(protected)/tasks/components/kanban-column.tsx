"use client"

import { memo, useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus } from "@/types/api"
import { TaskCard } from "./task-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TaskForm } from "./task-form"

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

// Per-status column visual identity
const COLUMN_CONFIG: Record<TaskStatus, {
  bg: string
  headerColor: string
  ring: string
  dot: string
}> = {
  Backlog: {
    bg: "bg-slate-900/90",
    headerColor: "text-slate-300",
    ring: "ring-slate-500",
    dot: "bg-slate-500",
  },
  "In Progress": {
    bg: "bg-blue-950/90",
    headerColor: "text-blue-300",
    ring: "ring-blue-500",
    dot: "bg-blue-500",
  },
  Review: {
    bg: "bg-violet-950/90",
    headerColor: "text-violet-300",
    ring: "ring-violet-500",
    dot: "bg-violet-500",
  },
  Done: {
    bg: "bg-emerald-950/90",
    headerColor: "text-emerald-300",
    ring: "ring-emerald-500",
    dot: "bg-emerald-500",
  },
}

export const KanbanColumn = memo(function KanbanColumn({ status, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const [showForm, setShowForm] = useState(false)
  const cfg = COLUMN_CONFIG[status] ?? COLUMN_CONFIG.Backlog

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-72 rounded-xl p-3 border border-white/5",
        cfg.bg,
        isOver && `ring-2 ${cfg.ring}`,
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
          <h3 className={cn("font-semibold text-sm", cfg.headerColor)}>{status}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            {tasks.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", cfg.headerColor, "hover:bg-white/10")}
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Cards */}
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[2rem]">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </div>
      </SortableContext>

      {/* Inline add form */}
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
})
