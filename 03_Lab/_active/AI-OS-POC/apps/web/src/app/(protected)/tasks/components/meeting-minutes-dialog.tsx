"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { FileText, Loader2, Sparkles, Check } from "lucide-react"

interface ExtractedTask {
  title: string
  description: string | null
  assignee_hint: string | null
  due_date: string | null
  task_type: string
  priority_hint: string
}

interface MeetingMinutesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
}

const TASK_TYPE_COLORS: Record<string, string> = {
  code: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  content: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  research: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  business: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  manual: "bg-muted text-muted-foreground",
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
}

const NO_PROJECT = "__none__"

export function MeetingMinutesDialog({ open, onOpenChange, defaultProjectId }: MeetingMinutesDialogProps) {
  const qc = useQueryClient()
  const [step, setStep] = useState<"input" | "review">("input")
  const [notes, setNotes] = useState("")
  const [projectId, setProjectId] = useState(defaultProjectId ?? NO_PROJECT)
  const [extracted, setExtracted] = useState<ExtractedTask[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["projects-list"],
    queryFn: () => fetch("/api/bff/projects").then(r => r.json()),
    staleTime: 60_000,
  })

  // Extract tasks (preview)
  const { mutate: extract, isPending: extracting } = useMutation({
    mutationFn: () =>
      fetch("/api/bff/tasks/from-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_notes: notes,
          project_id: projectId === NO_PROJECT ? undefined : projectId,
          create: false,
        }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error)
        return
      }
      const tasks: ExtractedTask[] = data.extracted ?? []
      setExtracted(tasks)
      setSelected(new Set(tasks.map((_, i) => i))) // select all by default
      setStep("review")
    },
    onError: () => toast.error("Extraction failed"),
  })

  // Create selected tasks
  const { mutate: createTasks, isPending: creating } = useMutation({
    mutationFn: () => {
      const toCreate = extracted.filter((_, i) => selected.has(i))
      return fetch("/api/bff/tasks/from-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_notes: toCreate.map(t => t.title).join("\n"),
          project_id: projectId === NO_PROJECT ? undefined : projectId,
          create: true,
        }),
      }).then(r => r.json())
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error)
        return
      }
      toast.success(`${data.count} task${data.count !== 1 ? "s" : ""} created`)
      qc.invalidateQueries({ queryKey: ["tasks"] })
      handleClose()
    },
    onError: () => toast.error("Failed to create tasks"),
  })

  function handleClose() {
    setStep("input")
    setNotes("")
    setExtracted([])
    setSelected(new Set())
    onOpenChange(false)
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Minutes → Tasks
          </SheetTitle>
          <SheetDescription>
            {step === "input"
              ? "Paste your meeting notes and AI will extract action items."
              : `${extracted.length} tasks found — select which to create.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {step === "input" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Project (optional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT} className="text-sm">No project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Meeting Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={`Paste meeting notes here...\n\nExample:\n"John will review the Q2 budget by Friday.\nSarah to send updated wireframes to client.\nTeam to research competitor pricing before next sprint."`}
                  className="text-sm min-h-[220px] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => extract()}
                  disabled={extracting || notes.trim().length < 10}
                >
                  {extracting ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Extracting...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Extract Tasks</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selected.size} of {extracted.length} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSelected(new Set(extracted.map((_, i) => i)))}
                  >
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSelected(new Set())}
                  >
                    None
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {extracted.map((task, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.has(i)
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-muted/20 opacity-60"
                    }`}
                    onClick={() => toggleSelect(i)}
                  >
                    <Checkbox
                      checked={selected.has(i)}
                      onCheckedChange={() => toggleSelect(i)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-medium leading-snug">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground leading-snug">{task.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TASK_TYPE_COLORS[task.task_type] ?? TASK_TYPE_COLORS.manual}`}>
                          {task.task_type}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[task.priority_hint] ?? PRIORITY_COLORS.medium}`}>
                          {task.priority_hint}
                        </span>
                        {task.assignee_hint && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            👤 {task.assignee_hint}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            📅 {task.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
                  ← Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => createTasks()}
                  disabled={creating || selected.size === 0}
                >
                  {creating ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating...</>
                  ) : (
                    <><Check className="h-3.5 w-3.5 mr-1.5" />Create {selected.size} Task{selected.size !== 1 ? "s" : ""}</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
