"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-activity.tsx

import { useQuery } from "@tanstack/react-query"
import {
  Activity,
  CheckSquare,
  CheckCircle2,
  UserPlus,
  FolderKanban,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditLogEntry } from "@/types/api"

interface ProjectActivityProps {
  projectId: string
}

// ─── Icon config per action type ──────────────────────────────────────────────

const ACTION_ICON: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  task_created:            { icon: CheckSquare,  bg: "bg-blue-500/15",   color: "text-blue-400" },
  task_completed:          { icon: CheckCircle2, bg: "bg-green-500/15",  color: "text-green-400" },
  task_updated:            { icon: CheckSquare,  bg: "bg-blue-500/15",   color: "text-blue-400" },
  member_added:            { icon: UserPlus,     bg: "bg-orange-500/15", color: "text-orange-400" },
  member_removed:          { icon: UserPlus,     bg: "bg-red-500/15",    color: "text-red-400" },
  project_created:         { icon: FolderKanban, bg: "bg-purple-500/15", color: "text-purple-400" },
  project_updated:         { icon: FolderKanban, bg: "bg-purple-500/15", color: "text-purple-400" },
  document_link_added:     { icon: FileText,     bg: "bg-cyan-500/15",   color: "text-cyan-400" },
  document_link_removed:   { icon: FileText,     bg: "bg-red-500/15",    color: "text-red-400" },
}

const DEFAULT_ACTION = { icon: Activity, bg: "bg-muted", color: "text-muted-foreground" }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectActivity({ projectId }: ProjectActivityProps) {
  const { data: events = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["project-activity", projectId],
    queryFn: () =>
      fetch(`/api/bff/projects/${projectId}/activity`)
        .then((r) => r.ok ? r.json() : [])
        .then((d) => Array.isArray(d) ? d : []),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">Loading activity...</div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">No activity recorded for this project yet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Heading */}
      <div className="mb-4">
        <h3 className="text-base font-semibold">Project Activity</h3>
        <p className="text-sm text-muted-foreground">
          Track all project-related events and activities
        </p>
      </div>

      {/* Event list */}
      <div className="space-y-1">
        {events.map((event, i) => {
          const cfg = ACTION_ICON[event.action] ?? DEFAULT_ACTION
          const Icon = cfg.icon

          return (
            <div
              key={event.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-colors"
            >
              {/* Timeline icon + line */}
              <div className="relative flex flex-col items-center shrink-0 pt-0.5">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                    cfg.bg,
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                </div>
                {i < events.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />
                )}
              </div>

              {/* Event text */}
              <div className="flex-1 min-w-0 pb-2">
                <p className="text-sm">
                  <span className="font-medium text-foreground">
                    {event.actor_name || "System"}
                  </span>{" "}
                  <span className="text-muted-foreground">{actionLabel(event.action)}</span>
                  {event.target_label && (
                    <span className="text-muted-foreground"> · {event.target_label}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {formatRelative(event.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
