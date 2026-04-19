"use client"
// apps/web/src/app/(protected)/time-tracking/components/time-entry-form.tsx
// Manual time entry form with Zod + React Hook Form

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CreateTimeEntrySchema, type CreateTimeEntryInput } from "@/lib/schemas"
import type { Project } from "@/types/api"
import { UserSelect } from "@/components/ui/user-select"

interface TimeEntryFormProps {
  onSuccess: () => void
  onCancel: () => void
  isManager?: boolean
}

export function TimeEntryForm({ onSuccess, onCancel, isManager = false }: TimeEntryFormProps) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTimeEntryInput>({
    resolver: zodResolver(CreateTimeEntrySchema),
    defaultValues: {
      date: today,
      billable: true,
      duration_minutes: 60,
    },
  })

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/bff/projects").then((r) => r.json()),
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: (data: CreateTimeEntryInput) =>
      fetch("/api/bff/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to create time entry")
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-summary"] })
      onSuccess()
    },
  })

  const onSubmit = (data: CreateTimeEntryInput) => {
    const body = {
      ...data,
      task_id: data.task_id === "none" ? undefined : data.task_id,
    }
    mutation.mutate(body)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Project */}
      <div className="space-y-1">
        <Label>Project</Label>
        <Controller
          name="project_id"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
          )}
        />
        {errors.project_id && (
          <p className="text-xs text-destructive">{errors.project_id.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label>Description</Label>
        <Input
          {...register("description")}
          placeholder="What did you work on?"
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Duration */}
      <div className="space-y-1">
        <Label>Duration (minutes)</Label>
        <Input
          type="number"
          min={1}
          {...register("duration_minutes", { valueAsNumber: true })}
          placeholder="60"
        />
        {errors.duration_minutes && (
          <p className="text-xs text-destructive">{errors.duration_minutes.message}</p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-1">
        <Label>Date</Label>
        <Input type="date" {...register("date")} />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Log on behalf of (managers only) */}
      {isManager && (
        <div className="space-y-1">
          <Label>Log on behalf of</Label>
          <UserSelect
            value={watch("user_id")}
            onChange={(v) => setValue("user_id" as any, v)}
            placeholder="Myself (default)"
          />
        </div>
      )}

      {/* Billable */}
      <div className="flex items-center gap-2">
        <Controller
          name="billable"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="billable"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="billable">Billable</Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Log Time"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">Failed to log time. Please try again.</p>
      )}
    </form>
  )
}
