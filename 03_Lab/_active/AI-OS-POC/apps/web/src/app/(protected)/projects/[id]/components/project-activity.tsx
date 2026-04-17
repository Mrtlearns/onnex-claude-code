"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-activity.tsx

import { useQuery } from "@tanstack/react-query"
import { Activity } from "lucide-react"
import type { AuditLogEntry } from "@/types/api"

interface ProjectActivityProps {
  projectId: string
}

function formatRelative(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export function ProjectActivity({ projectId }: ProjectActivityProps) {
  const { data: events = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["project-activity", projectId],
    queryFn: () => fetch(`/api/bff/projects/${projectId}/activity`).then(r => r.json()),
    staleTime: 30_000,
  })

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading activity...</div>
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
    <div className="space-y-1">
      {events.map((event, i) => (
        <div
          key={event.id}
          className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-colors"
        >
          {/* Timeline line */}
          <div className="relative flex flex-col items-center shrink-0 pt-0.5">
            <div className="h-2 w-2 rounded-full bg-primary/60 shrink-0" />
            {i < events.length - 1 && (
              <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />
            )}
          </div>

          <div className="flex-1 min-w-0 pb-2">
            <p className="text-sm">
              <span className="font-medium text-foreground">{event.actor_name || "System"}</span>{" "}
              <span className="text-muted-foreground">{actionLabel(event.action)}</span>
              {event.target_label && (
                <span className="text-muted-foreground"> · {event.target_label}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{formatRelative(event.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
