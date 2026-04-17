"use client"
// apps/web/src/app/(protected)/notifications/components/notifications-client.tsx

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Session } from "next-auth"
import type { Notification } from "@/types/api"

function getNotificationHref(notification: Notification): string | null {
  if (!notification.entity_type || !notification.entity_id) return null
  switch (notification.entity_type) {
    case "task": return `/tasks?id=${notification.entity_id}`
    case "deal": return `/deals?id=${notification.entity_id}`
    case "invoice": return `/invoices?id=${notification.entity_id}`
    case "project": return `/projects/${notification.entity_id}`
    default: return null
  }
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

interface Props { session: Session | null }

export function NotificationsClient({ session: _session }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications-all"],
    queryFn: () => fetch("/api/bff/notifications").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const unreadCount = notifications.filter((n) => n.read_at === null).length

  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/bff/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/bff/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] })
    },
  })

  function handleClick(notif: Notification) {
    if (!notif.read_at) markRead.mutate(notif.id)
    const href = getNotificationHref(notif)
    if (href) router.push(href)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 rounded-full px-2 text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
          className="gap-2"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ul className="divide-y max-w-2xl mx-auto px-4 py-4 w-full">
            {notifications.map((notif) => (
              <li
                key={notif.id}
                className={`flex items-start gap-3 py-4 cursor-pointer rounded-lg px-3 transition-colors hover:bg-muted/50 ${
                  notif.read_at === null ? "bg-accent/40" : ""
                }`}
                onClick={() => handleClick(notif)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {notif.read_at === null ? (
                    <span className="block h-2 w-2 rounded-full bg-blue-500 mt-1" />
                  ) : (
                    <span className="block h-2 w-2 rounded-full bg-transparent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notif.read_at === null ? "font-semibold" : "font-medium"}`}>
                    {notif.title}
                  </p>
                  {notif.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                      {notif.body}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(notif.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
