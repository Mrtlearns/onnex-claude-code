"use client"
// apps/web/src/app/(protected)/projects/components/project-form.tsx
// Create/Edit project form with Zod + React Hook Form validation

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CreateProjectSchema, type CreateProjectInput, type Project, type Client } from "@/types/api"

interface ProjectFormProps {
  project?: Project // if provided: edit mode
  onSuccess: () => void
  onCancel: () => void
}

export function ProjectForm({ project, onSuccess, onCancel }: ProjectFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!project

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["clients", {}],
    queryFn: () =>
      fetch("/api/bff/clients").then((r) => r.json()),
    staleTime: 60_000,
  })

  // Normalize ISO timestamp → YYYY-MM-DD for <input type="date">
  const toDateInput = (d?: string) => (d ? d.slice(0, 10) : "")

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      name: project?.name ?? "",
      client_id: project?.client_id ?? "",
      status: project?.status ?? "Active",
      start_date: toDateInput(project?.start_date),
      end_date: toDateInput(project?.end_date),
      budget: project?.budget,
      description: project?.description ?? "",
      health: project?.health,
      color: project?.color ?? "slate",
    },
  })

  // Re-populate form when project prop arrives (dialog may mount before data loads)
  useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        client_id: project.client_id ?? "",
        status: project.status,
        start_date: toDateInput(project.start_date),
        end_date: toDateInput(project.end_date),
        budget: project.budget,
        description: project.description ?? "",
        health: project.health,
        color: project.color ?? "slate",
      })
    }
  }, [project, reset])

  const mutation = useMutation({
    mutationFn: async (data: CreateProjectInput) => {
      const url = isEdit ? `/api/bff/projects/${project!.id}` : "/api/bff/projects"
      const method = isEdit ? "PATCH" : "POST"
      // Clean up empty client_id
      const body = { ...data, client_id: (data.client_id === "none" || !data.client_id) ? undefined : data.client_id }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Save failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      onSuccess()
    },
  })

  const onSubmit = handleSubmit((data) => mutation.mutate(data))

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="project-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="project-name"
          aria-label="Name"
          placeholder="Website Redesign"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="project-status" className="text-sm font-medium">
          Status
        </label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="project-status" aria-label="Status">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && (
          <p className="text-sm text-destructive">{errors.status.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="project-client" className="text-sm font-medium">
          Client (optional)
        </label>
        <Controller
          name="client_id"
          control={control}
          render={({ field }) => (
            <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
              <SelectTrigger id="project-client" aria-label="Client">
                <SelectValue placeholder="No client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="project-start" className="text-sm font-medium">
            Start Date
          </label>
          <Input
            id="project-start"
            type="date"
            {...register("start_date")}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="project-end" className="text-sm font-medium">
            End Date
          </label>
          <Input
            id="project-end"
            type="date"
            {...register("end_date")}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="project-budget" className="text-sm font-medium">
          Budget ($)
        </label>
        <Input
          id="project-budget"
          type="number"
          min="0"
          step="0.01"
          placeholder="10000"
          {...register("budget", {
            setValueAs: (v) => (v === "" ? undefined : parseFloat(v)),
          })}
        />
        {errors.budget && (
          <p className="text-sm text-destructive">{errors.budget.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="project-health" className="text-sm font-medium">
          Health
        </label>
        <Controller
          name="health"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
              <SelectTrigger id="project-health" aria-label="Health">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="project-color" className="text-sm font-medium">
          Color
        </label>
        <Controller
          name="color"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? "slate"} onValueChange={field.onChange}>
              <SelectTrigger id="project-color" aria-label="Color">
                <SelectValue placeholder="Slate (default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slate">Slate</SelectItem>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="purple">Purple</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="red">Red</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="project-description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="project-description"
          placeholder="Project overview, goals, context..."
          rows={3}
          {...register("description")}
        />
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Save failed"}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
        </Button>
      </div>
    </form>
  )
}
