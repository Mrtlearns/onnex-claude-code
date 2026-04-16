"use client"
// apps/web/src/app/(protected)/time-tracking/components/timesheet-view.tsx
// Weekly timesheet — 7-day grid with per-day totals, billable split, and entry list

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { TimeEntry, WeeklySummaryDay } from "@/types/api"

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

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function TimesheetView() {
  const queryClient = useQueryClient()
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(
    getMondayOfWeek(new Date())
  )

  const weekEnd = addDays(currentWeekStart, 6)

  const { data: summary = [], isLoading: summaryLoading } = useQuery<WeeklySummaryDay[]>({
    queryKey: ["weekly-summary", currentWeekStart],
    queryFn: () =>
      fetch(
        `/api/bff/time-entries/weekly-summary?user_id=me&week_start=${currentWeekStart}`
      ).then((r) => r.json()),
    staleTime: 60_000,
  })

  const { data: entries = [], isLoading: entriesLoading } = useQuery<TimeEntry[]>({
    queryKey: ["time-entries", { date_from: currentWeekStart, date_to: weekEnd }],
    queryFn: () =>
      fetch(
        `/api/bff/time-entries?user_id=me&date_from=${currentWeekStart}&date_to=${weekEnd}`
      ).then((r) => r.json()),
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/bff/time-entries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-summary"] })
    },
  })

  const prevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7))
  const nextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7))

  // Build day lookup from summary
  const dayMap = new Map(summary.map((d) => [d.date, d]))

  // Total for the week
  const weekTotal = summary.reduce((sum, d) => sum + d.total_minutes, 0)
  const weekBillable = summary.reduce((sum, d) => sum + d.billable_minutes, 0)

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevWeek}>
          &larr; Prev
        </Button>
        <div className="text-sm font-medium">
          {new Date(currentWeekStart).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          {" — "}
          {new Date(weekEnd).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          <span className="ml-3 text-muted-foreground">
            {formatMinutes(weekTotal)} total ({formatMinutes(weekBillable)} billable)
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={nextWeek}>
          Next &rarr;
        </Button>
      </div>

      {/* 7-day grid */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label, i) => {
          const date = addDays(currentWeekStart, i)
          const day = dayMap.get(date)
          const isToday = date === new Date().toISOString().split("T")[0]
          return (
            <Card
              key={date}
              className={`${isToday ? "ring-2 ring-primary" : ""} text-center`}
            >
              <CardHeader className="pb-1 pt-2 px-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <p className="text-xs">
                  {new Date(date).toLocaleDateString(undefined, {
                    month: "numeric",
                    day: "numeric",
                  })}
                </p>
              </CardHeader>
              <CardContent className="pb-2 px-2">
                {summaryLoading ? (
                  <Skeleton className="h-4 w-full" />
                ) : day ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {formatMinutes(day.total_minutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMinutes(day.billable_minutes)} bill.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Entry list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries this week. Start the timer or log time manually.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs">{formatMinutes(entry.duration_minutes)}</span>
                    {entry.billable && (
                      <Badge variant="secondary" className="text-xs">
                        Billable
                      </Badge>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(entry.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
