"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CreateTaskSchema, type CreateTaskInput } from "@/lib/schemas"
import type { TaskStatus } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const STATUS_OPTIONS: TaskStatus[] = ["Backlog", "In Progress", "Review", "Done"]
const NO_PROJECT = "__none__"
const NO_ASSIGNEE = "__none_assignee__"

interface TaskFormProps {
  defaultStatus?: TaskStatus
  onSuccess?: () => void
  onCancel?: () => void
  taskId?: string
  defaultValues?: Partial<CreateTaskInput>
}

export function TaskForm({ defaultStatus = "Backlog", onSuccess, onCancel, taskId, defaultValues }: TaskFormProps) {
  const qc = useQueryClient()

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["projects-list"],
    queryFn: () => fetch("/api/bff/projects").then(r => r.json()),
    staleTime: 60_000,
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      status: defaultStatus,
      ...defaultValues,
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      const url = taskId ? `/api/bff/tasks/${taskId}` : "/api/bff/tasks"
      const method = taskId ? "PATCH" : "POST"
      return fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] })
      onSuccess?.()
    },
  })

  return (
    <form onSubmit={handleSubmit(d => mutate(d))} className="space-y-3 p-3 bg-background border rounded-lg">
      <div className="space-y-1.5">
        <Label htmlFor="task-title" className="text-xs">Title *</Label>
        <Input
          id="task-title"
          {...register("title")}
          placeholder="Task title"
          className="h-8 text-sm"
          aria-label="Title"
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Status</Label>
        <Select
          value={watch("status")}
          onValueChange={val => setValue("status", val as TaskStatus)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Project (optional)</Label>
        <Select
          value={watch("project_id") ?? NO_PROJECT}
          onValueChange={val => setValue("project_id", val === NO_PROJECT ? undefined : val)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROJECT} className="text-sm">None</SelectItem>
            {projects.map((p: { id: string; name: string }) => (
              <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Assignee</Label>
        <Select
          value={watch("assignee_id") ?? NO_ASSIGNEE}
          onValueChange={val => setValue("assignee_id", val === NO_ASSIGNEE ? undefined : val)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ASSIGNEE} className="text-sm">Unassigned</SelectItem>
            <SelectItem value="__ai__" className="text-sm">
              <span className="flex items-center gap-1.5">
                🤖 AI Agent
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Due Date (optional)</Label>
        <Input
          type="date"
          {...register("due_date")}
          className="h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Start Date</Label>
          <Input type="date" {...register("start_date")} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End Date</Label>
          <Input type="date" {...register("end_date")} className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description (optional)</Label>
        <Textarea
          {...register("description")}
          placeholder="Task description..."
          className="text-sm min-h-[60px]"
        />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : (taskId ? "Save" : "Create Task")}
        </Button>
      </div>
    </form>
  )
}
