"use client"

import { memo, useState, useRef, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  DollarSign,
  Layers,
  CheckSquare,
  Maximize2,
  Minimize2,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Project, ProjectMember } from "@/types/api"
import { cn } from "@/lib/utils"

// ─── Per-status visual config ─────────────────────────────────────────────────

type ProjectStatus = "Active" | "On Hold" | "Completed"

const STATUS_CONFIG: Record<ProjectStatus, {
  accentBar: string
  cardBg: string
  border: string
  headerColor: string
  progressBar: string
}> = {
  Active: {
    accentBar:   "bg-blue-500",
    cardBg:      "bg-blue-950/60",
    border:      "border-blue-800/40",
    headerColor: "text-blue-300",
    progressBar: "bg-blue-500",
  },
  "On Hold": {
    accentBar:   "bg-amber-500",
    cardBg:      "bg-amber-950/60",
    border:      "border-amber-800/40",
    headerColor: "text-amber-300",
    progressBar: "bg-amber-500",
  },
  Completed: {
    accentBar:   "bg-emerald-500",
    cardBg:      "bg-emerald-950/60",
    border:      "border-emerald-800/40",
    headerColor: "text-emerald-300",
    progressBar: "bg-emerald-500",
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShortDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const AVATAR_PALETTE = [
  "bg-rose-600 text-rose-50",
  "bg-orange-600 text-orange-50",
  "bg-amber-600 text-amber-50",
  "bg-lime-700 text-lime-50",
  "bg-teal-700 text-teal-50",
  "bg-cyan-700 text-cyan-50",
  "bg-sky-700 text-sky-50",
  "bg-indigo-700 text-indigo-50",
  "bg-violet-700 text-violet-50",
  "bg-fuchsia-700 text-fuchsia-50",
  "bg-pink-700 text-pink-50",
]

function avatarColor(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

// ─── Health badge ─────────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: Project["health"] }) {
  if (!health) return null
  const config = {
    on_track: { dot: "bg-green-500",  label: "On Track" },
    at_risk:  { dot: "bg-amber-500",  label: "At Risk" },
    blocked:  { dot: "bg-red-500",    label: "Blocked" },
  }[health]
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-white/5 border border-white/10 text-muted-foreground">
      <span className={cn("h-[5px] w-[5px] rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  )
}

// ─── Pure card content (exported — used by DragOverlay too) ───────────────────

export interface ProjectCardContentProps {
  project: Project
  overlay?: boolean
}

export const ProjectCardContent = memo(function ProjectCardContent({
  project,
  overlay,
}: ProjectCardContentProps) {
  const cfg = STATUS_CONFIG[project.status as ProjectStatus] ?? STATUS_CONFIG.Active

  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ["project-members", project.id],
    queryFn: () =>
      fetch(`/api/bff/projects/${project.id}/members`).then(r => r.json()),
    staleTime: 60_000,
    enabled: !overlay,
  })

  const totalPhases = project.phases?.length ?? 0
  const completedPhases = project.phases?.filter(p => p.completed).length ?? 0
  const phaseProgress = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0

  const dateLabel = (() => {
    if (!project.start_date) return null
    const start = formatShortDate(project.start_date)
    if (!project.end_date) return start
    return `${start} – ${formatShortDate(project.end_date)}`
  })()

  const shownMembers = members.slice(0, 4)
  const extraMembers = members.length - 4

  return (
    <div className="flex min-w-0">
      {/* Left accent bar */}
      <div className={cn("w-[3px] rounded-l-md shrink-0 self-stretch", cfg.accentBar)} />

      {/* Card body */}
      <div className="flex-1 px-3 py-2.5 min-w-0 space-y-2">

        {/* Project name + client */}
        <div>
          <p className={cn("font-semibold text-sm leading-snug truncate", cfg.headerColor)}>
            {project.name}
          </p>
          {project.client_name && (
            <p className="text-xs text-muted-foreground truncate">{project.client_name}</p>
          )}
        </div>

        {/* Health badge */}
        {project.health && <HealthBadge health={project.health} />}

        {/* Date range */}
        {dateLabel && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>{dateLabel}</span>
          </div>
        )}

        {/* Budget chip */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <DollarSign className="h-3 w-3 shrink-0" />
          <span>{project.budget ? formatBudget(project.budget) : "—"}</span>
        </div>

        {/* Phase progress */}
        {totalPhases > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="h-3 w-3 shrink-0" />
              <span>{completedPhases}/{totalPhases} phases</span>
            </div>
            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", cfg.progressBar)}
                style={{ width: `${phaseProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Team avatar stack */}
        {!overlay && members.length > 0 && (
          <div className="flex items-center -space-x-2">
            {shownMembers.map((m, i) => (
              <Avatar
                key={m.user_id}
                className="h-5 w-5 ring-1 ring-background shrink-0"
                style={{ zIndex: shownMembers.length - i }}
              >
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className={cn("text-[8px] font-bold", avatarColor(m.user_id))}>
                  {m.user_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {extraMembers > 0 && (
              <div
                className="h-5 w-5 rounded-full text-[8px] font-bold flex items-center justify-center ring-1 bg-slate-700 text-slate-300 ring-slate-600"
                style={{ zIndex: 0 }}
              >
                +{extraMembers}
              </div>
            )}
          </div>
        )}

        {/* Task count chip */}
        {project.task_count !== undefined && project.task_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckSquare className="h-3 w-3 shrink-0" />
            <span>{project.task_count} tasks</span>
          </div>
        )}
      </div>
    </div>
  )
})

// ─── Project detail modal ─────────────────────────────────────────────────────

function ProjectDetailModal({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ["project-members", project.id],
    queryFn: () =>
      fetch(`/api/bff/projects/${project.id}/members`).then(r => r.json()),
    staleTime: 60_000,
    enabled: open,
  })

  const totalPhases = project.phases?.length ?? 0
  const completedPhases = project.phases?.filter(p => p.completed).length ?? 0
  const totalTasks = project.task_count ?? 0
  const taskProgress = totalTasks > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0

  const statusVariant = {
    Active:    "default" as const,
    Completed: "secondary" as const,
    "On Hold": "outline" as const,
  }[project.status] ?? "outline"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-y-auto",
          expanded
            ? "fixed inset-0 max-w-none w-screen h-screen rounded-none translate-x-0 translate-y-0 top-0 left-0 m-0"
            : "max-w-2xl max-h-[85vh]",
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-snug">{project.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={statusVariant}>{project.status}</Badge>
                {project.health && <HealthBadge health={project.health} />}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(v => !v)}
              >
                {expanded
                  ? <Minimize2 className="h-4 w-4" />
                  : <Maximize2 className="h-4 w-4" />
                }
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href={`/projects/${project.id}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Project Information */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Project Information
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Client</p>
                <p className="font-medium">{project.client_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Budget</p>
                <p className="font-medium">{project.budget ? formatBudget(project.budget) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Start Date</p>
                <p className="font-medium">
                  {project.start_date ? formatShortDate(project.start_date) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">End Date</p>
                <p className="font-medium">
                  {project.end_date ? formatShortDate(project.end_date) : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs mb-0.5">Progress</p>
                <p className="font-medium">
                  {totalTasks > 0 ? `${taskProgress}% (${totalTasks} tasks)` : "—"}
                  {totalPhases > 0 && ` · ${completedPhases}/${totalPhases} phases`}
                </p>
              </div>
            </div>
          </section>

          {/* Team Members */}
          {members.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Team Members
              </h3>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className={cn("text-[9px] font-bold", avatarColor(m.user_id))}>
                        {m.user_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{m.user_name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {project.description && (
            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Description
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
            </section>
          )}

          {/* Footer */}
          <p className="text-xs text-muted-foreground/60 border-t border-white/5 pt-3">
            Full financial summary available on the{" "}
            <Link href={`/projects/${project.id}`} className="underline underline-offset-2 hover:text-muted-foreground">
              project detail page →
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sortable ProjectKanbanCard ───────────────────────────────────────────────

interface ProjectKanbanCardProps {
  project: Project
}

export const ProjectKanbanCard = memo(function ProjectKanbanCard({
  project,
}: ProjectKanbanCardProps) {
  const cfg = STATUS_CONFIG[project.status as ProjectStatus] ?? STATUS_CONFIG.Active
  const [modalOpen, setModalOpen] = useState(false)
  const wasDragging = useRef(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id })

  useEffect(() => {
    if (isDragging) wasDragging.current = true
  }, [isDragging])

  const style = { transform: CSS.Transform.toString(transform), transition }

  function handleClick() {
    if (wasDragging.current) { wasDragging.current = false; return }
    setModalOpen(true)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        className={cn(
          "rounded-md border overflow-hidden cursor-grab active:cursor-grabbing select-none transition-colors",
          cfg.cardBg,
          cfg.border,
          "hover:brightness-110",
          isDragging && "opacity-20 scale-95",
        )}
      >
        <ProjectCardContent project={project} />
      </div>

      <ProjectDetailModal
        project={project}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  )
})
