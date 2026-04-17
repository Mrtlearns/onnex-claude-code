"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Notification } from "@/types/api"

function getNotificationHref(notification: Notification): string | null {
  if (!notification.entity_type || !notification.entity_id) return null
  switch (notification.entity_type) {
    case "task":
      return `/tasks?id=${notification.entity_id}`
    case "deal":
      return `/deals?id=${notification.entity_id}`
    case "invoice":
      return `/invoices?id=${notification.entity_id}`
    case "project":
      return `/projects/${notification.entity_id}`
    default:
      return null
  }
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Badge count query — always polling every 15s
  const { data: unreadNotifs = [] } = useQuery<Notification[]>({
    queryKey: ["notifications-unread"],
    queryFn: () =>
      fetch("/api/bff/notifications?unread_only=true").then((r) => r.json()),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  const unreadCount = unreadNotifs.length

  // Full feed query — only fetches when popover is open
  const { data: feed = [] } = useQuery<Notification[]>({
    queryKey: ["notifications-feed"],
    queryFn: () => fetch("/api/bff/notifications").then((r) => r.json()),
    enabled: isOpen,
    staleTime: 5_000,
  })

  // Mark individual notification read
  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/bff/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-feed"] })
    },
  })

  // Mark all notifications read
  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/bff/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-feed"] })
    },
  })

  function handleNotificationClick(notif: Notification) {
    markRead.mutate(notif.id)
    const href = getNotificationHref(notif)
    if (href) {
      setIsOpen(false)
      router.push(href)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="notification-bell"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header row */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            disabled={unreadCount === 0}
            onClick={() => markAllRead.mutate()}
          >
            Mark all read
          </Button>
        </div>

        {/* Feed list */}
        {feed.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-8 text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {feed.map((notif) => (
              <li
                key={notif.id}
                className={`cursor-pointer px-4 py-3 transition-colors hover:bg-muted/50 ${
                  notif.read_at === null ? "bg-accent" : ""
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <p className="text-sm font-medium leading-tight">{notif.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {notif.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeTime(notif.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
