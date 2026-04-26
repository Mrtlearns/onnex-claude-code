"use client"
// apps/web/src/app/(protected)/settings/components/smtp-settings-form.tsx
// Email tab — SMTP config form + test-send button

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SmtpConfigSchema } from "@/lib/schemas"
import type { SmtpConfig } from "@/types/api"
import type { z } from "zod"

type SmtpFormValues = z.infer<typeof SmtpConfigSchema>

export function SmtpSettingsForm() {
  const queryClient = useQueryClient()
  const [testEmail, setTestEmail] = useState("")
  const [showTestInput, setShowTestInput] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)

  const { data, isLoading } = useQuery<SmtpConfig>({
    queryKey: ["settings", "smtp"],
    queryFn: () => fetch("/api/bff/settings/smtp").then((r) => r.json()),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SmtpFormValues>({
    resolver: zodResolver(SmtpConfigSchema),
  })

  useEffect(() => {
    if (data) {
      reset({
        host: data.host,
        port: data.port,
        user: data.user,
        from_address: data.from_address,
        password: "",
      })
    }
  }, [data, reset])

  const mutation = useMutation({
    mutationFn: async (values: SmtpFormValues) => {
      const body: Record<string, unknown> = {
        host: values.host,
        port: values.port,
        user: values.user,
        from_address: values.from_address,
      }
      if (values.password) {
        body.password = values.password
      }
      const res = await fetch("/api/bff/settings/smtp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to save SMTP config")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "smtp"] })
      toast.success("SMTP settings saved")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  async function handleTestSend() {
    if (!testEmail) return
    setIsSendingTest(true)
    try {
      const res = await fetch("/api/bff/settings/smtp/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success(`Test email sent to ${testEmail}`)
        setShowTestInput(false)
        setTestEmail("")
      } else {
        toast.error(result.error ?? "Test email failed")
      }
    } catch {
      toast.error("Network error — test email failed")
    } finally {
      setIsSendingTest(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-5"
      >
        <h2 className="text-lg font-medium">SMTP Configuration</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtp-host">SMTP Host</Label>
          <Input id="smtp-host" {...register("host")} />
          {errors.host && (
            <p className="text-xs text-destructive">{errors.host.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtp-port">Port</Label>
          <Input id="smtp-port" type="number" {...register("port")} />
          {errors.port && (
            <p className="text-xs text-destructive">{errors.port.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtp-user">Username</Label>
          <Input id="smtp-user" {...register("user")} />
          {errors.user && (
            <p className="text-xs text-destructive">{errors.user.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtp-from">From Address</Label>
          <Input id="smtp-from" type="email" {...register("from_address")} />
          {errors.from_address && (
            <p className="text-xs text-destructive">
              {errors.from_address.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="smtp-password">Password</Label>
            {data?.has_password && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
          <Input
            id="smtp-password"
            type="password"
            placeholder={data?.has_password ? "Password saved — leave blank to keep" : "Enter password"}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save SMTP Settings"}
          </Button>
        </div>
      </form>

      <div className="border-t pt-4">
        <h3 className="text-sm font-medium mb-3">Test Email</h3>
        {showTestInput ? (
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleTestSend}
              disabled={isSendingTest || !testEmail}
              variant="secondary"
            >
              {isSendingTest ? "Sending..." : "Send"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setShowTestInput(false); setTestEmail("") }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowTestInput(true)}>
            Send Test Email
          </Button>
        )}
      </div>
    </div>
  )
}
