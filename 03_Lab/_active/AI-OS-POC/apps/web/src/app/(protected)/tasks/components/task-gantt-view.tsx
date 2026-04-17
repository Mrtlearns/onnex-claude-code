"use client"

import { useState, useMemo } from "react"
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react"
import "gantt-task-react/dist/index.css"
import type { Task, TaskDependency } from "@/types/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"

interface TaskGanttViewProps {
  tasks: Task[]
  dependencies?: TaskDependency[]
}

const STATUS_COLORS: Record<string, string> = {
  "Backlog": "#94a3b8",
  "In Progress": "#3b82f6",
  "Review": "#f59e0b",
  "Done": "#22c55e",
}

function toGanttTask(task: Task): GanttTask | null {
  const start = task.start_date ? new Date(task.start_date) : null
  const end = task.end_date ? new Date(task.end_date) : null

  if (!start || !end) return null

  // Ensure end > start
  const endDate = end <= start ? new Date(start.getTime() + 86400000) : end

  return {
    id: task.id,
    name: task.title,
    start,
    end: endDate,
    type: "task",
    progress: task.status === "Done" ? 100 : task.status === "Review" ? 75 : task.status === "In Progress" ? 40 : 0,
    isDisabled: false,
    styles: {
      backgroundColor: STATUS_COLORS[task.status] ?? "#94a3b8",
      backgroundSelectedColor: STATUS_COLORS[task.status] ?? "#94a3b8",
    },
    dependencies: [],
    project: task.project_id,
  }
}

export function TaskGanttView({ tasks, dependencies = [] }: TaskGanttViewProps) {
  const qc = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week)

  const { mutate: patchTask } = useMutation({
    mutationFn: async ({ id, start_date, end_date }: { id: string; start_date: string; end_date: string }) =>
      fetch(`/api/bff/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date, end_date }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })

  // Build gantt tasks — only tasks with dates
  const ganttTasks = useMemo<GanttTask[]>(() => {
    const mapped = tasks.map(toGanttTask).filter((t): t is GanttTask => t !== null)
    // Wire up dependencies
    const depMap: Record<string, string[]> = {}
    for (const dep of dependencies) {
      if (!depMap[dep.task_id]) depMap[dep.task_id] = []
      depMap[dep.task_id].push(dep.depends_on_task_id)
    }
    return mapped.map(t => ({ ...t, dependencies: depMap[t.id] ?? [] }))
  }, [tasks, dependencies])

  const tasksWithoutDates = tasks.filter(t => !t.start_date || !t.end_date)

  if (ganttTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No tasks with start and end dates.</p>
        <p className="text-xs mt-1">Set start/end dates on tasks to see them here.</p>
        {tasksWithoutDates.length > 0 && (
          <p className="text-xs mt-2 text-amber-500">{tasksWithoutDates.length} task(s) missing date ranges.</p>
        )}
      </div>
    )
  }

  function handleTaskChange(task: GanttTask) {
    patchTask({
      id: task.id,
      start_date: task.start.toISOString().split("T")[0],
      end_date: task.end.toISOString().split("T")[0],
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted-foreground">View:</span>
        {([ViewMode.Day, ViewMode.Week, ViewMode.Month] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              viewMode === mode
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            {mode}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {ganttTasks.length} of {tasks.length} tasks shown
        </span>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          onDateChange={handleTaskChange}
          listCellWidth="155px"
          columnWidth={viewMode === ViewMode.Day ? 40 : viewMode === ViewMode.Week ? 120 : 200}
          rowHeight={36}
          headerHeight={50}
          barFill={80}
          todayColor="rgba(59, 130, 246, 0.08)"
        />
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
