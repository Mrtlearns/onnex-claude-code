"use client"
// apps/web/src/app/(protected)/dashboard/components/activity-feed.tsx
// Last 20 activity events with color-coded icons and relative timestamps

import { useQuery } from "@tanstack/react-query"
import { CheckSquare, TrendingUp, FileText, Receipt } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ActivityEvent } from "@/types/api"

type EventType = ActivityEvent["event_type"]

const EVENT_CONFIG: Record<
  EventType,
  { icon: React.ComponentType<{ className?: string }>; bg: string; color: string; label: string }
> = {
  task_updated: {
    icon: CheckSquare,
    bg: "bg-primary/10",
    color: "text-primary",
    label: "Task updated",
  },
  deal_stage_changed: {
    icon: TrendingUp,
    bg: "bg-emerald-500/10",
    color: "text-emerald-500",
    label: "Deal stage changed",
  },
  document_uploaded: {
    icon: FileText,
    bg: "bg-blue-500/10",
    color: "text-blue-400",
    label: "Document uploaded",
  },
  invoice_sent: {
    icon: Receipt,
    bg: "bg-amber-500/10",
    color: "text-amber-500",
    label: "Invoice sent",
  },
}

const FALLBACK_CONFIG = {
  icon: FileText,
  bg: "bg-muted",
  color: "text-muted-foreground",
  label: "Event",
}

function formatRelativeTime(isoString: string): string {
  const diffMinutes = (Date.now() - new Date(isoString).getTime()) / 60000
  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${Math.floor(diffMinutes)}m ago`
  const diffHours = diffMinutes / 60
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  const diffDays = diffHours / 24
  return `${Math.floor(diffDays)}d ago`
}

function formatEventLabel(event: ActivityEvent): string {
  const config = EVENT_CONFIG[event.event_type] ?? FALLBACK_CONFIG
  const title =
    (event.metadata as Record<string, string>)?.title ??
    (event.metadata as Record<string, string>)?.name ??
    event.entity_id
  return `${config.label}: ${title}`
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ActivityFeed() {
  const { data, isLoading } = useQuery<ActivityEvent[]>({
    queryKey: ["activity"],
    queryFn: () => fetch("/api/bff/dashboard/activity").then((r) => r.json()),
    refetchInterval: 30_000,
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <ActivitySkeleton />}

        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
        )}

        {!isLoading && data && data.length > 0 && (
          <ul data-testid="activity-list" className="space-y-3">
            {data.slice(0, 20).map((event) => {
              const config = EVENT_CONFIG[event.event_type] ?? FALLBACK_CONFIG
              const Icon = config.icon
              return (
                <li key={event.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      config.bg
                    )}
                    data-event-type={event.event_type}
                  >
                    <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{formatEventLabel(event)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.created_at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
