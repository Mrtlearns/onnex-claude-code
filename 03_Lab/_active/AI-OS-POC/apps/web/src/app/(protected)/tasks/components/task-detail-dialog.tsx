"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Task, TaskStatus } from "@/types/api"
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
import { SubtasksPanel } from "./subtasks-panel"
import { CommentsPanel } from "./comments-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const STATUS_OPTIONS: TaskStatus[] = ["Backlog", "In Progress", "Review", "Done"]

interface TaskDetailDialogProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const qc = useQueryClient()
  const [description, setDescription] = useState(task.description ?? "")
  const [dueDate, setDueDate] = useState(task.due_date ?? "")

  const { mutate: patchTask } = useMutation({
    mutationFn: async (body: Partial<Task>) =>
      fetch(`/api/bff/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })

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

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assignee ID</Label>
              <Input
                value={task.assignee_id ?? ""}
                readOnly
                className="h-8 text-sm text-muted-foreground"
                placeholder="Unassigned"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => patchTask({ description: description || undefined })}
              placeholder="Add a description..."
              className="text-sm min-h-[100px]"
            />
          </div>

          <Tabs defaultValue="subtasks" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="subtasks" className="text-sm">Subtasks</TabsTrigger>
              <TabsTrigger value="comments" className="text-sm">Comments</TabsTrigger>
            </TabsList>
            <TabsContent value="subtasks" className="mt-3">
              <SubtasksPanel taskId={task.id} />
            </TabsContent>
            <TabsContent value="comments" className="mt-3">
              <CommentsPanel taskId={task.id} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
