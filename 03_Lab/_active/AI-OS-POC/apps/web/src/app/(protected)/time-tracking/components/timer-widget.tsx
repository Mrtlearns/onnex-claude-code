"use client"
// apps/web/src/app/(protected)/time-tracking/components/timer-widget.tsx
// Start/Stop timer UI — reads/writes Zustand timer-store; on stop POSTs time entry

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { useTimerStore } from "@/store/timer-store"
import type { Project } from "@/types/api"

function formatElapsed(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

export function TimerWidget() {
  const queryClient = useQueryClient()
  const {
    isRunning,
    description,
    start_time,
    project_id,
    startTimer,
    stopTimer,
    cancelTimer,
    updateDescription,
  } = useTimerStore()

  const [selectedProject, setSelectedProject] = useState<string>("")
  const [localDesc, setLocalDesc] = useState<string>(description)
  const [elapsed, setElapsed] = useState<string>("0:00")
  const [isSaving, setIsSaving] = useState(false)

  // Fetch projects for selector
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/bff/projects").then((r) => r.json()),
    staleTime: 60_000,
  })

  // Tick elapsed timer while running
  useEffect(() => {
    if (!isRunning || !start_time) {
      setElapsed("0:00")
      return
    }
    setElapsed(formatElapsed(start_time))
    const interval = setInterval(() => {
      setElapsed(formatElapsed(start_time))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, start_time])

  // Sync description from store
  useEffect(() => {
    setLocalDesc(description)
  }, [description])

  const handleStart = () => {
    if (!selectedProject) return
    startTimer(selectedProject, null, localDesc)
  }

  const handleStop = async () => {
    setIsSaving(true)
    try {
      const stopped = stopTimer()
      if (stopped) {
        await fetch("/api/bff/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: stopped.project_id,
            task_id: stopped.task_id,
            description: stopped.description || "Timer entry",
            duration_minutes: stopped.duration_minutes,
            date: new Date().toISOString().split("T")[0],
            billable: true,
          }),
        })
        queryClient.invalidateQueries({ queryKey: ["time-entries"] })
        queryClient.invalidateQueries({ queryKey: ["weekly-summary"] })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDescChange = (val: string) => {
    setLocalDesc(val)
    if (isRunning) {
      updateDescription(val)
    }
  }

  if (isRunning) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span
                  className="font-mono text-lg font-semibold tabular-nums"
                  data-testid="elapsed-time"
                >
                  {elapsed}
                </span>
                <span className="text-sm text-muted-foreground">
                  {projects.find((p) => p.id === project_id)?.name ?? ""}
                </span>
              </div>
              <Input
                placeholder="What are you working on?"
                value={localDesc}
                onChange={(e) => handleDescChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleStop} disabled={isSaving} variant="destructive">
                Stop
              </Button>
              <button
                onClick={cancelTimer}
                className="text-xs text-muted-foreground hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label>Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-1">
            <Label>Description</Label>
            <Input
              placeholder="What are you working on?"
              value={localDesc}
              onChange={(e) => handleDescChange(e.target.value)}
            />
          </div>
          <Button onClick={handleStart} disabled={!selectedProject}>
            Start
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
