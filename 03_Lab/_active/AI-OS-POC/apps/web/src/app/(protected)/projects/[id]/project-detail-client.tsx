"use client"
// apps/web/src/app/(protected)/projects/[id]/project-detail-client.tsx
// Project detail — tabbed layout (Overview / Tasks / Timeline / Finances / Documents / Team / Activity / Notes)

import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProjectForm } from "../components/project-form"
import { MeetingMinutesDialog } from "../../tasks/components/meeting-minutes-dialog"
import { KanbanBoard } from "../../tasks/components/kanban-board"
import { TaskGanttView } from "../../tasks/components/task-gantt-view"
import { ProjectNotes } from "./components/project-notes"
import { ProjectActivity } from "./components/project-activity"
import { ProjectTeam } from "./components/project-team"
import { ProjectPlaneTab } from "./components/project-plane-tab"
import { PlaneLinkDialog } from "./components/plane-link-dialog"
import { ProjectFilesTab } from "./components/project-files-tab"
import { ProjectReporting } from "./components/project-reporting"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  ListTodo,
  ExternalLink,
  ChevronDown,
  Loader2,
} from "lucide-react"
import type { Project, TimeEntry, Task, TaskDependency } from "@/types/api"

// ─── Health badge config ───────────────────────────────────────────────────────

const HEALTH_CONFIG = {
  on_track: { label: "On Track", cls: "bg-green-500/15 text-green-400 border border-green-500/30" },
  at_risk:  { label: "At Risk",  cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  blocked:  { label: "Blocked",  cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
} as const

// ─── Project color dot ─────────────────────────────────────────────────────────

const COLOR_DOTS: Record<string, string> = {
  slate:  "bg-slate-400",
  blue:   "bg-blue-400",
  green:  "bg-green-400",
  purple: "bg-purple-400",
  amber:  "bg-amber-400",
  red:    "bg-red-400",
}

function daysRemaining(endDate?: string): number | null {
  if (!endDate) return null
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProjectDetailClientProps {
  projectId: string
}

export function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [showMeeting, setShowMeeting] = useState(false)
  const [showPlaneLink, setShowPlaneLink] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState("")
  const titleRef = useRef<HTMLInputElement>(null)

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: () =>
      fetch(`/api/bff/projects/${projectId}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load project")
        return r.json()
      }),
    staleTime: 60_000,
  })

  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["time-entries", { project_id: projectId }],
    queryFn: () =>
      fetch(`/api/bff/time-entries?project_id=${projectId}`).then((r) => r.json()),
    staleTime: 60_000,
  })

  // Tasks tab — only fetch when active
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", { project_id: projectId }],
    queryFn: () =>
      fetch(`/api/bff/tasks?project_id=${projectId}`).then((r) => r.json()),
    enabled: activeTab === "tasks",
    staleTime: 60_000,
  })

  // Timeline tab — only fetch when active
  const { data: ganttData } = useQuery<{ tasks: Task[]; dependencies: TaskDependency[] }>({
    queryKey: ["tasks", { project_id: projectId, view: "gantt" }],
    queryFn: () =>
      fetch(`/api/bff/tasks?project_id=${projectId}&view=gantt`).then((r) => r.json()),
    enabled: activeTab === "timeline",
    staleTime: 60_000,
  })

  const loggedHours = timeEntries.reduce((sum, e) => sum + e.duration_minutes, 0) / 60

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

  const createInPlaneMutation = useMutation({
    mutationFn: () =>
      fetch("/api/bff/plane/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aios_project_id: projectId, name: project?.name ?? "Project" }),
      }).then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.error ?? "Create failed") })
        return r.json()
      }),
    onSuccess: (data: any) => {
      // plane_project_name already stored server-side by the POST handler
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })

  const { data: integrations } = useQuery({
    queryKey: ["me-integrations"],
    queryFn: () => fetch("/api/bff/me/integrations").then(r => r.json()),
    staleTime: 60_000,
  })
  const hasPlaneToken = !!integrations?.plane_api_token

  const unlinkPlaneMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bff/projects/${projectId}/plane`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plane_project_id: null, plane_workspace_slug: null }),
      }).then(r => { if (!r.ok) throw new Error("Unlink failed") }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      setConfirmUnlink(false)
    },
  })

  const saveTitleMutation = useMutation({
    mutationFn: (name: string) =>
      fetch(`/api/bff/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => {
        if (!r.ok) throw new Error("Save failed")
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      setEditingTitle(false)
    },
  })

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!project) {
    return <p className="text-muted-foreground">Project not found.</p>
  }

  const phases = project.phases ?? []
  const completedPhases = phases.filter((p) => p.completed).length
  const totalPhases = phases.length
  const completionPct = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0

  const days = daysRemaining(project.end_date)
  const health = project.health ? HEALTH_CONFIG[project.health] : null
  const colorDot = COLOR_DOTS[project.color ?? "slate"] ?? COLOR_DOTS.slate

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`h-3 w-3 rounded-full shrink-0 ${colorDot}`} />

            {editingTitle ? (
              <input
                ref={titleRef}
                className="text-2xl font-semibold bg-transparent border-b border-primary outline-none min-w-0 w-64"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={() => {
                  const trimmed = titleInput.trim()
                  if (trimmed && trimmed !== project.name) {
                    saveTitleMutation.mutate(trimmed)
                  } else {
                    setEditingTitle(false)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                  if (e.key === "Escape") setEditingTitle(false)
                }}
              />
            ) : (
              <h1
                className="text-2xl font-semibold cursor-text hover:text-foreground/80 transition-colors"
                onClick={() => { setTitleInput(project.name); setEditingTitle(true) }}
                title="Click to rename"
              >
                {project.name}
              </h1>
            )}

            <Badge
              variant={
                project.status === "Active" ? "default"
                  : project.status === "Completed" ? "secondary"
                  : "outline"
              }
            >
              {project.status}
            </Badge>

            {health && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${health.cls}`}>
                {health.label}
              </span>
            )}

            {days !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                days < 0 ? "bg-red-500/15 text-red-400"
                  : days <= 7 ? "bg-amber-500/15 text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {days < 0
                  ? `${Math.abs(days)}d overdue`
                  : days === 0 ? "Due today"
                  : `${days}d remaining`}
              </span>
            )}

            {project.archived_at && <Badge variant="secondary">Archived</Badge>}
          </div>

          {/* Client + progress bar */}
          <div className="flex items-center gap-4 flex-wrap">
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
            {totalPhases > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <span>{completionPct}% complete</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowMeeting(true)}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            From Meeting
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          {!project.archived_at && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        <TabsList className="w-full justify-start h-auto flex-wrap gap-0 bg-transparent border-b border-border rounded-none px-0 pb-0">
          {[
            { value: "overview",  label: "Overview" },
            { value: "tasks",     label: "Tasks" },
            { value: "timeline",  label: "Timeline" },
            { value: "finances",  label: "Reporting" },
            { value: "files",     label: "Documents" },
            { value: "team",      label: "Team" },
            { value: "activity",  label: "Activity" },
            { value: "notes",     label: "Notes" },
            ...(project.plane_project_id ? [{ value: "plane", label: "Plane" }] : []),
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          {/* Project Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Client</p>
                  <p className="font-medium">{project.client_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Budget</p>
                  <p className="font-medium">
                    {project.budget ? `$${project.budget.toLocaleString()}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Start Date</p>
                  <p className="font-medium">
                    {project.start_date
                      ? new Date(project.start_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">End Date</p>
                  <p className="font-medium">
                    {project.end_date
                      ? new Date(project.end_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Progress</p>
                  <p className="font-medium">
                    {totalPhases > 0
                      ? `${completionPct}% (${completedPhases}/${totalPhases} phases)`
                      : project.task_count
                      ? `${project.task_count} tasks`
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ListTodo className="h-3.5 w-3.5" /> Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{project.task_count ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Budget
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
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Logged Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{loggedHours.toFixed(1)}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Phases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{completedPhases}<span className="text-base text-muted-foreground font-normal">/{totalPhases}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {project.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          )}

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
              {phases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No phases defined. Edit the project to add phases.</p>
              ) : (
                <div className="space-y-2">
                  {phases.map((phase, idx) => (
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
                      <span className={`flex-1 text-sm ${phase.completed ? "line-through text-muted-foreground" : ""}`}>
                        {phase.name}
                      </span>
                      {(phase.start_date || phase.end_date) && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {phase.start_date ? new Date(phase.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          {phase.start_date && phase.end_date ? " – " : ""}
                          {phase.end_date ? new Date(phase.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plane link card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plane</CardTitle>
            </CardHeader>
            <CardContent>
              {project.plane_project_id ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Linked to{" "}
                    <a
                      href={`https://plane.on-nex.us/${project.plane_workspace_slug}/projects/${project.plane_project_id}/issues/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground font-medium underline-offset-2 hover:underline"
                    >
                      {project.plane_project_name ?? project.plane_workspace_slug} <ExternalLink className="inline h-3 w-3 mb-0.5" />
                    </a>
                  </p>
                  {confirmUnlink ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-destructive">Unlink this project from Plane?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => unlinkPlaneMutation.mutate()}
                        disabled={unlinkPlaneMutation.isPending}
                      >
                        {unlinkPlaneMutation.isPending ? "Unlinking…" : "Confirm"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://plane.on-nex.us/${project.plane_workspace_slug}/projects/${project.plane_project_id}/issues/`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open in Plane <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmUnlink(true)}
                      >
                        Unlink
                      </Button>
                    </div>
                  )}
                </div>
              ) : hasPlaneToken ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={createInPlaneMutation.isPending}
                    >
                      {createInPlaneMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Creating in Plane…
                        </>
                      ) : (
                        <>
                          Link Plane Project <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => createInPlaneMutation.mutate()}>
                      Create new in Plane
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPlaneLink(true)}>
                      Link existing project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href="/settings?tab=integrations"
                  className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Link your Plane API token to enable project linking
                </Link>
              )}
              {createInPlaneMutation.isError && (
                <p className="text-xs text-destructive mt-2">
                  {(createInPlaneMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tasks ── */}
        <TabsContent value="tasks" className="pt-4">
          <KanbanBoard tasks={tasks} />
        </TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline" className="pt-4">
          {!ganttData ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading timeline...</div>
          ) : ganttData.tasks.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No tasks with dates found for this project. Add start/end dates to tasks to see them here.
            </div>
          ) : (
            <TaskGanttView tasks={ganttData.tasks} dependencies={ganttData.dependencies} />
          )}
        </TabsContent>

        {/* ── Reporting ── */}
        <TabsContent value="finances" className="pt-4">
          <ProjectReporting projectId={projectId} project={project} />
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="files" className="pt-4">
          <ProjectFilesTab projectId={projectId} />
        </TabsContent>

        {/* ── Team ── */}
        <TabsContent value="team" className="pt-4">
          <ProjectTeam projectId={projectId} />
        </TabsContent>

        {/* ── Activity ── */}
        <TabsContent value="activity" className="pt-4">
          <ProjectActivity projectId={projectId} />
        </TabsContent>

        {/* ── Notes ── */}
        <TabsContent value="notes" className="pt-4">
          <ProjectNotes projectId={projectId} />
        </TabsContent>

        {/* ── Plane ── */}
        {project.plane_project_id && (
          <TabsContent value="plane" className="pt-4">
            <ProjectPlaneTab project={project} active={activeTab === "plane"} />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Plane Link Dialog ── */}
      <PlaneLinkDialog
        projectId={projectId}
        open={showPlaneLink}
        onOpenChange={setShowPlaneLink}
      />

      {/* ── Edit Dialog ── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <ProjectForm
            key={project.id}
            project={project}
            onSuccess={() => {
              setShowEdit(false)
              queryClient.invalidateQueries({ queryKey: ["project", projectId] })
            }}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>

      <MeetingMinutesDialog
        open={showMeeting}
        onOpenChange={setShowMeeting}
        defaultProjectId={projectId}
      />
    </div>
  )
}
