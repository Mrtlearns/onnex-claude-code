"use client"
// apps/web/src/app/(protected)/projects/[id]/timeline/timeline-client.tsx
// Client Component — fetches project tasks in gantt view and renders TaskGanttView

import { useQuery } from "@tanstack/react-query"
import type { Task, TaskDependency } from "@/types/api"
import { TaskGanttView } from "@/app/(protected)/tasks/components/task-gantt-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface ProjectTimelineClientProps {
  projectId: string
}

export function ProjectTimelineClient({ projectId }: ProjectTimelineClientProps) {
  const { data, isLoading } = useQuery<{ tasks: Task[]; dependencies: TaskDependency[] }>({
    queryKey: ["tasks", { project_id: projectId, view: "gantt" }],
    queryFn: () =>
      fetch(`/api/bff/tasks?project_id=${projectId}&view=gantt`).then(r => r.json()),
    staleTime: 60_000,
  })

  const tasks = data?.tasks ?? []
  const dependencies = data?.dependencies ?? []

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Project
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Project Timeline</h1>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading timeline...</div>
      ) : (
        <TaskGanttView tasks={tasks} dependencies={dependencies} />
      )}
    </div>
  )
}
