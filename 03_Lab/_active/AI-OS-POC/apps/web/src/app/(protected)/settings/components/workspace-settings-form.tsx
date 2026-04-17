"use client"
// apps/web/src/app/(protected)/settings/components/workspace-settings-form.tsx
// General tab form — workspace name, timezone, default currency

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WorkspaceSettingsSchema } from "@/lib/schemas"
import type { z } from "zod"

type WorkspaceSettingsInput = z.infer<typeof WorkspaceSettingsSchema>

export function WorkspaceSettingsForm() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<WorkspaceSettingsInput>({
    queryKey: ["settings", "workspace"],
    queryFn: () =>
      fetch("/api/bff/settings/workspace").then((r) => r.json()),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceSettingsInput>({
    resolver: zodResolver(WorkspaceSettingsSchema),
  })

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        timezone: data.timezone,
        default_currency: data.default_currency,
        logo_url: data.logo_url ?? undefined,
      })
    }
  }, [data, reset])

  const mutation = useMutation({
    mutationFn: async (values: WorkspaceSettingsInput) => {
      const res = await fetch("/api/bff/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to save settings")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "workspace"] })
      toast.success("Settings saved")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex flex-col gap-5 max-w-md"
    >
      <h2 className="text-lg font-medium">Workspace Settings</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-name">Workspace Name</Label>
        <Input id="ws-name" {...register("name")} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-timezone">Timezone</Label>
        <Input
          id="ws-timezone"
          placeholder="America/Los_Angeles"
          {...register("timezone")}
        />
        {errors.timezone && (
          <p className="text-xs text-destructive">{errors.timezone.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-currency">Default Currency (3-letter code)</Label>
        <Input
          id="ws-currency"
          maxLength={3}
          placeholder="USD"
          {...register("default_currency")}
        />
        {errors.default_currency && (
          <p className="text-xs text-destructive">
            {errors.default_currency.message}
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}
