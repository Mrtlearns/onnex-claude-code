"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Task, TaskStatus, StaffMember } from "@/types/api"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SubtasksPanel } from "./subtasks-panel"
import { CommentsPanel } from "./comments-panel"
import { CmsSection } from "../../documents/components/cms-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Bot, X, UserPlus } from "lucide-react"

const STATUS_OPTIONS: TaskStatus[] = ["Backlog", "In Progress", "Review", "Done"]
const TASK_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "code", label: "Code" },
  { value: "content", label: "Content" },
  { value: "research", label: "Research" },
  { value: "business", label: "Business" },
]

// ─── AssigneeMultiSelect ──────────────────────────────────────────────────────

interface AssigneeMultiSelectProps {
  assigneeIds: string[]
  staff: StaffMember[]
  onChange: (ids: string[]) => void
}

function AssigneeMultiSelect({ assigneeIds, staff, onChange }: AssigneeMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const assigned = staff.filter(s => assigneeIds.includes(s.user_id))
  const unassigned = staff.filter(s => !assigneeIds.includes(s.user_id))

  function remove(id: string) {
    onChange(assigneeIds.filter(a => a !== id))
  }
  function add(id: string) {
    onChange([...assigneeIds, id])
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
      {assigned.map(s => (
        <span key={s.user_id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
          <Avatar className="h-4 w-4">
            <AvatarImage src={s.avatar_url ?? undefined} />
            <AvatarFallback className="text-[8px]">{s.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {s.display_name}
          <button type="button" onClick={() => remove(s.user_id)} className="ml-0.5 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {unassigned.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            <UserPlus className="h-3 w-3" />
            Add
          </button>
          {open && (
            <div className="absolute top-full mt-1 left-0 z-50 bg-popover border rounded-md shadow-md min-w-[160px] py-1">
              {unassigned.map(s => (
                <button
                  key={s.user_id}
                  type="button"
                  onClick={() => add(s.user_id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={s.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">{s.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {assigned.length === 0 && unassigned.length === 0 && (
        <span className="text-xs text-muted-foreground italic">No staff</span>
      )}
    </div>
  )
}

// ─── TaskDetailDialog ─────────────────────────────────────────────────────────

interface TaskDetailDialogProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const qc = useQueryClient()
  const [description, setDescription] = useState(task.description ?? "")
  const [dueDate, setDueDate] = useState(task.due_date ?? "")
  const [startDate, setStartDate] = useState(task.start_date ?? "")
  const [endDate, setEndDate] = useState(task.end_date ?? "")
  const [estimatedHours, setEstimatedHours] = useState(task.estimated_hours?.toString() ?? "")
  const [actualHours, setActualHours] = useState(task.actual_hours?.toString() ?? "")
  const [savedFlash, setSavedFlash] = useState(false)

  const { mutate: patchTask } = useMutation({
    mutationFn: async (body: Partial<Task>) =>
      fetch(`/api/bff/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    },
  })

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: () => fetch("/api/bff/staff").then(r => r.json()),
    staleTime: 120_000,
  })

  const isAiTask = task.assignee_id === "__ai__"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <SheetTitle className="flex-1 text-lg">{task.title}</SheetTitle>
            <Select
              value={task.status}
              onValueChange={(val) => patchTask({ status: val as TaskStatus })}
            >
              <SelectTrigger className="w-36 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        {savedFlash && (
          <div className="text-xs text-green-600 dark:text-green-400 text-right -mt-2 mb-1">Saved ✓</div>
        )}

        <div className="mt-6 space-y-4">
          {/* Date fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                onBlur={() => patchTask({ start_date: startDate || undefined })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                onBlur={() => patchTask({ end_date: endDate || undefined })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                onBlur={() => patchTask({ due_date: dueDate || undefined })}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Hours + Task Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Est. Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={estimatedHours}
                onChange={e => setEstimatedHours(e.target.value)}
                onBlur={() => patchTask({ estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined })}
                className="h-8 text-sm"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Actual Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={actualHours}
                onChange={e => setActualHours(e.target.value)}
                onBlur={() => patchTask({ actual_hours: actualHours ? parseFloat(actualHours) : undefined })}
                className="h-8 text-sm"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Task Type</Label>
              <Select
                value={task.task_type ?? "manual"}
                onValueChange={(val) => patchTask({ task_type: val as Task["task_type"] })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assignees</Label>
              {isAiTask ? (
                <div className="h-8 px-2 flex items-center gap-1.5 border rounded text-xs bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 w-fit">
                  <Bot className="h-3.5 w-3.5" />
                  AI Agent
                </div>
              ) : (
                <AssigneeMultiSelect
                  assigneeIds={task.assignee_ids ?? (task.assignee_id ? [task.assignee_id] : [])}
                  staff={staff}
                  onChange={(ids) => patchTask({ assignee_ids: ids, assignee_id: ids[0] ?? undefined })}
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => patchTask({ description: description || undefined })}
              placeholder="Add a description..."
              className="text-sm min-h-[80px]"
            />
          </div>

          <Tabs defaultValue="subtasks" className="mt-4">
            <TabsList className={`grid w-full ${isAiTask ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="subtasks" className="text-sm">Subtasks</TabsTrigger>
              <TabsTrigger value="comments" className="text-sm">Comments</TabsTrigger>
              <TabsTrigger value="files" className="text-sm">Files</TabsTrigger>
              {isAiTask && (
                <TabsTrigger value="ai" className="text-sm">
                  <Bot className="h-3.5 w-3.5 mr-1" />AI Output
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="subtasks" className="mt-3">
              <SubtasksPanel taskId={task.id} />
            </TabsContent>
            <TabsContent value="comments" className="mt-3">
              <CommentsPanel taskId={task.id} />
            </TabsContent>
            <TabsContent value="files" className="mt-3">
              <CmsSection
                entityType="task"
                entityId={task.id}
                projectId={task.project_id}
                title="Task Files"
              />
            </TabsContent>
            {isAiTask && (
              <TabsContent value="ai" className="mt-3">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Bot className="h-4 w-4" />
                    <span>
                      {task.ai_completed_at
                        ? `Completed at ${new Date(task.ai_completed_at).toLocaleString()}`
                        : task.status === "In Progress"
                        ? "AI is working on this task..."
                        : "Waiting for AI assignment..."}
                    </span>
                  </div>
                  {task.ai_output ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {task.ai_output}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No output yet.</p>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Footer: explicit save for any pending text changes + close */}
        <div className="mt-6 flex justify-end gap-2 border-t pt-4">
          {savedFlash && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center mr-auto">Saved ✓</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              patchTask({ description: description || undefined, start_date: startDate || undefined, end_date: endDate || undefined, due_date: dueDate || undefined, estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined, actual_hours: actualHours ? parseFloat(actualHours) : undefined })
              onOpenChange(false)
            }}
          >
            Save &amp; Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
