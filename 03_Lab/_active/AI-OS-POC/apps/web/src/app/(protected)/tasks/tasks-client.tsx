"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import type { Task, TaskDependency } from "@/types/api"
import { Button } from "@/components/ui/button"
import { KanbanBoard } from "./components/kanban-board"
import { TaskListView } from "./components/task-list-view"
import { TaskGanttView } from "./components/task-gantt-view"
import { TaskForm } from "./components/task-form"
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { LayoutGrid, List, GanttChart, FileText } from "lucide-react"
import { MeetingMinutesDialog } from "./components/meeting-minutes-dialog"

interface TasksClientProps {
  searchParams: {
    view?: string
    assignee_id?: string
    project_id?: string
    status?: string
  }
}

export function TasksClient({ searchParams }: TasksClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showNewTask, setShowNewTask] = useState(false)
  const [showMeeting, setShowMeeting] = useState(false)

  const view = searchParams.view ?? "kanban"
  const isMyTasks = searchParams.assignee_id === "me"

  const apiParams: Record<string, string | undefined> = {}
  if (searchParams.assignee_id) apiParams.assignee_id = searchParams.assignee_id
  if (searchParams.project_id) apiParams.project_id = searchParams.project_id
  if (searchParams.status) apiParams.status = searchParams.status

  const { data: tasksData } = useQuery<Task[] | { tasks: Task[]; dependencies: TaskDependency[] }>({
    queryKey: ["tasks", apiParams, view],
    queryFn: async () => {
      const params = view === "gantt" ? { ...apiParams, view: "gantt" } : apiParams
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => v && qs.set(k, v))
      return fetch(`/api/bff/tasks${qs.toString() ? "?" + qs.toString() : ""}`).then(r => r.json())
    },
    staleTime: 60_000,
  })

  // Normalize — BFF may return array (list/kanban) or object with tasks + dependencies (gantt)
  const tasks: Task[] = Array.isArray(tasksData)
    ? tasksData
    : (tasksData as any)?.tasks ?? []
  const dependencies: TaskDependency[] = Array.isArray(tasksData)
    ? []
    : (tasksData as any)?.dependencies ?? []

  function updateUrl(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const all = { ...searchParams, ...updates }
    Object.entries(all).forEach(([k, v]) => v && sp.set(k, v))
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Tasks</h1>
          <Button
            variant={isMyTasks ? "default" : "outline"}
            size="sm"
            onClick={() => updateUrl({ assignee_id: isMyTasks ? undefined : "me" })}
          >
            My Tasks
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => updateUrl({ view: "kanban" })}
            title="Kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => updateUrl({ view: "list" })}
            title="List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "gantt" ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => updateUrl({ view: "gantt" })}
            title="Gantt"
          >
            <GanttChart className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMeeting(true)}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            From Meeting
          </Button>
          <Button size="sm" onClick={() => setShowNewTask(true)}>
            New Task
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanBoard tasks={tasks} />
      ) : view === "list" ? (
        <TaskListView tasks={tasks} />
      ) : (
        <TaskGanttView tasks={tasks} dependencies={dependencies} />
      )}

      <Sheet open={showNewTask} onOpenChange={setShowNewTask}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Task</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <TaskForm onSuccess={() => setShowNewTask(false)} onCancel={() => setShowNewTask(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <MeetingMinutesDialog
        open={showMeeting}
        onOpenChange={setShowMeeting}
        defaultProjectId={searchParams.project_id}
      />
    </div>
  )
}
