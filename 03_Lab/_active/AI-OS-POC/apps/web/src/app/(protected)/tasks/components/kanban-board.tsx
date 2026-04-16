"use client"

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import type { Task, TaskStatus } from "@/types/api"
import { KanbanColumn } from "./kanban-column"
import { TaskDetailDialog } from "./task-detail-dialog"

const COLUMNS: TaskStatus[] = ["Backlog", "In Progress", "Review", "Done"]

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const qc = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { mutate: updateStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) =>
      fetch(`/api/bff/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newStatus = over.id as TaskStatus
    updateStatus({ id: active.id as string, status: newStatus })
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter(t => t.status === status)}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>
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
