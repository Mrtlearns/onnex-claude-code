"use client"
// apps/web/src/app/(protected)/projects/[id]/project-detail-client.tsx
// Client Component — project detail: tasks count, budget vs actual, phases, logged hours

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProjectForm } from "../components/project-form"
import type { Project, TimeEntry } from "@/types/api"

interface ProjectDetailClientProps {
  projectId: string
}

export function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: () =>
      fetch(`/api/bff/projects/${projectId}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load project")
        return r.json()
      }),
    staleTime: 60_000,
  })

  // TIME-05: Logged hours — computed from all time entries for this project
  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["time-entries", { project_id: projectId }],
    queryFn: () =>
      fetch(`/api/bff/time-entries?project_id=${projectId}`).then((r) => r.json()),
    staleTime: 60_000,
  })

  const loggedHours =
    timeEntries.reduce((sum, e) => sum + e.duration_minutes, 0) / 60

  const archiveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bff/projects/${projectId}/archive`, { method: "PATCH" }).then((r) => {
        if (!r.ok) throw new Error("Archive failed")
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      router.push("/projects")
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!project) {
    return <p className="text-muted-foreground">Project not found.</p>
  }

  const completedPhases = project.phases.filter((p) => p.completed).length
  const totalPhases = project.phases.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge
              variant={
                project.status === "Active"
                  ? "default"
                  : project.status === "Completed"
                    ? "secondary"
                    : "outline"
              }
            >
              {project.status}
            </Badge>
            {project.archived_at && <Badge variant="secondary">Archived</Badge>}
          </div>
          {project.client_name && (
            <p className="text-sm text-muted-foreground">
              Client:{" "}
              {project.client_id ? (
                <Link href={`/clients/${project.client_id}`} className="hover:underline">
                  {project.client_name}
                </Link>
              ) : (
                project.client_name
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          {!project.archived_at && (
            <Button
              variant="destructive"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{project.task_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {project.budget ? `$${project.budget.toLocaleString()}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actual Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          </CardContent>
        </Card>
        {/* TIME-05: Logged Hours KPI */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Logged Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loggedHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Phases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Phases</span>
            {totalPhases > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {completedPhases} / {totalPhases} complete
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {project.phases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No phases defined. Edit the project to add phases.
            </p>
          ) : (
            <div className="space-y-2">
              {project.phases.map((phase, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                >
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                      phase.completed
                        ? "bg-primary border-primary"
                        : "border-muted-foreground"
                    }`}
                  />
                  <span
                    className={
                      phase.completed ? "line-through text-muted-foreground" : ""
                    }
                  >
                    {phase.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates */}
      {(project.start_date || project.end_date) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Start</p>
              <p className="font-medium">
                {project.start_date
                  ? new Date(project.start_date).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">End</p>
              <p className="font-medium">
                {project.end_date
                  ? new Date(project.end_date).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <ProjectForm
            project={project}
            onSuccess={() => {
              setShowEdit(false)
              queryClient.invalidateQueries({ queryKey: ["project", projectId] })
            }}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
