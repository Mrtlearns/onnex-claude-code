"use client"

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core"
import { useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useMemo } from "react"
import type { Task, TaskStatus } from "@/types/api"
import { KanbanColumn } from "./kanban-column"
import { TaskDetailDialog } from "./task-detail-dialog"
import { TaskCardContent } from "./task-card"
import { cn } from "@/lib/utils"

const COLUMNS: TaskStatus[] = ["Backlog", "In Progress", "Review", "Done"]
const VALID_STATUSES = new Set<string>(COLUMNS)

// Prefer pointer-within for column targets, fall back to rect-intersection
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  return rectIntersection(args)
}

function OverlayCard({ task }: { task: Task }) {
  return (
    <div className={cn(
      "rounded-md border shadow-2xl rotate-1 scale-105",
      "bg-slate-800 border-slate-600",
      "ring-2 ring-primary/40",
    )}>
      <TaskCardContent task={task} isExpanded={false} onToggleExpand={() => {}} overlay />
    </div>
  )
}

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const qc = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  // Optimistic status override: taskId → status
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, TaskStatus>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Merge optimistic overrides into tasks for immediate visual feedback
  const displayTasks = useMemo(
    () => tasks.map(t => optimisticStatus[t.id] ? { ...t, status: optimisticStatus[t.id] } : t),
    [tasks, optimisticStatus],
  )

  // Pre-split tasks per column so KanbanColumn receives stable array refs
  const columnTasks = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { Backlog: [], "In Progress": [], Review: [], Done: [] }
    for (const t of displayTasks) { if (map[t.status]) map[t.status].push(t) }
    return map
  }, [displayTasks])

  const updateStatus = useCallback(async (id: string, status: TaskStatus) => {
    setOptimisticStatus(prev => ({ ...prev, [id]: status }))
    try {
      await fetch(`/api/bff/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      // Update cache directly — avoids a network round-trip and the flash
      // that happens when optimistic state is cleared before refetch completes
      qc.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
        old ? old.map(t => t.id === id ? { ...t, status } : t) : old
      )
    } catch {
      setOptimisticStatus(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    // Clear optimistic override only after cache is already updated
    setOptimisticStatus(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [qc])

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    let newStatus: TaskStatus
    if (VALID_STATUSES.has(over.id as string)) {
      newStatus = over.id as TaskStatus
    } else {
      const targetTask = displayTasks.find(t => t.id === over.id)
      if (!targetTask) return
      newStatus = targetTask.status
    }

    const currentTask = displayTasks.find(t => t.id === active.id)
    if (!currentTask || currentTask.status === newStatus) return

    updateStatus(active.id as string, newStatus)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columnTasks[status]}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask ? <OverlayCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
        />
      )}
    </>
  )
}
