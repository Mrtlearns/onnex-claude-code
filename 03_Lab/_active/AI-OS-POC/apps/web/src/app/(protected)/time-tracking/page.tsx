// apps/web/src/app/(protected)/time-tracking/page.tsx
// Server Component — prefetch current week's time entries, render timer + timesheet

import { auth } from "@/auth"
import { getQueryClient } from "@/lib/query-client"
import { apiGetTimeEntries } from "@/lib/api-client"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { TimerWidget } from "./components/timer-widget"
import { TimesheetView } from "./components/timesheet-view"
import { LogTimeButton } from "./components/log-time-button"

function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

export default async function TimeTrackingPage() {
  const session = await auth()
  const queryClient = getQueryClient()

  if (!session?.user?.token) return null

  const weekStart = getMondayOfWeek(new Date())
  const weekEnd = addDays(weekStart, 6)

  try {
    await queryClient.prefetchQuery({
      queryKey: ["time-entries", { date_from: weekStart, date_to: weekEnd }],
      queryFn: () =>
        apiGetTimeEntries(session.user.token, {
          user_id: "me",
          date_from: weekStart,
          date_to: weekEnd,
        }),
    })
  } catch {
    // silently proceed — client will fetch on mount
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Time Tracking</h1>
        <LogTimeButton />
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TimerWidget />
        <TimesheetView />
      </HydrationBoundary>
    </div>
  )
}
