"use client"
// apps/web/src/app/(protected)/settings/components/n8n-settings-form.tsx
// n8n webhook URL + enabled events checkboxes

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { N8nConfigSchema } from "@/lib/schemas"
import type { N8nConfig } from "@/types/api"
import type { z } from "zod"

type N8nFormValues = z.infer<typeof N8nConfigSchema>

const EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "deal_won", label: "Deal Won" },
  { value: "invoice_sent", label: "Invoice Sent" },
  { value: "task_completed", label: "Task Completed" },
]

export function N8nSettingsForm() {
  const queryClient = useQueryClient()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const { data, isLoading } = useQuery<N8nConfig>({
    queryKey: ["settings", "n8n"],
    queryFn: () => fetch("/api/bff/settings/n8n").then((r) => r.json()),
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<N8nFormValues>({
    resolver: zodResolver(N8nConfigSchema),
    defaultValues: { webhook_url: null, enabled_events: [] },
  })

  useEffect(() => {
    if (data) {
      reset({
        webhook_url: data.webhook_url,
        enabled_events: data.enabled_events as N8nFormValues["enabled_events"],
      })
    }
  }, [data, reset])

  const mutation = useMutation({
    mutationFn: async (values: N8nFormValues) => {
      const res = await fetch("/api/bff/settings/n8n", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to save n8n config")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "n8n"] })
      toast.success("n8n settings saved")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/bff/settings/n8n/test", { method: "POST" })
      const body = await res.json()
      if (body.ok) {
        setTestResult({ ok: true, msg: `Webhook reachable (HTTP ${body.status})` })
      } else {
        setTestResult({ ok: false, msg: body.error ?? `HTTP ${body.status}` })
      }
    } catch {
      setTestResult({ ok: false, msg: "Network error" })
    } finally {
      setTesting(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex flex-col gap-5 max-w-md"
    >
      <h2 className="text-lg font-medium">n8n Integration</h2>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="n8n-webhook">Webhook URL</Label>
          {data?.webhook_url && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
        <Input
          id="n8n-webhook"
          type="url"
          placeholder="https://your-n8n.example.com/webhook/..."
          {...register("webhook_url")}
        />
        {errors.webhook_url && (
          <p className="text-xs text-destructive">
            {errors.webhook_url.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Enabled Events</Label>
        <Controller
          name="enabled_events"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              {EVENT_OPTIONS.map((opt) => {
                const checked = (field.value ?? []).includes(
                  opt.value as "deal_won" | "invoice_sent" | "task_completed"
                )
                return (
                  <div key={opt.value} className="flex items-center gap-2">
                    <CheckboxPrimitive.Root
                      id={`event-${opt.value}`}
                      checked={checked}
                      onCheckedChange={(c) => {
                        const current = field.value ?? []
                        if (c) {
                          field.onChange([
                            ...current,
                            opt.value as "deal_won" | "invoice_sent" | "task_completed",
                          ])
                        } else {
                          field.onChange(
                            current.filter((v) => v !== opt.value)
                          )
                        }
                      }}
                      className="h-4 w-4 rounded border border-input bg-background flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    >
                      <CheckboxPrimitive.Indicator>
                        <CheckIcon className="h-3 w-3 text-primary-foreground" />
                      </CheckboxPrimitive.Indicator>
                    </CheckboxPrimitive.Root>
                    <Label htmlFor={`event-${opt.value}`} className="font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}
        />
        {errors.enabled_events && (
          <p className="text-xs text-destructive">
            {errors.enabled_events.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={testing || !data?.webhook_url}
            onClick={handleTest}
          >
            {testing ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Testing…</>
            ) : "Test Webhook"}
          </Button>
          {testResult && (
            <span className={`text-xs ${testResult.ok ? "text-green-500" : "text-destructive"}`}>
              {testResult.msg}
            </span>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save n8n Settings"}
        </Button>
      </div>
    </form>
  )
}
