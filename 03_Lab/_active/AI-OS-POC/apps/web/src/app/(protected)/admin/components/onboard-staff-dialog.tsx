"use client"
// Onboard new staff: creates Authentik user with password + user_profiles row

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { UserPlus } from "lucide-react"
import { TIMEZONES } from "@/lib/timezones"

const ROLES = [
  { value: "admin",        label: "Admin" },
  { value: "manager",      label: "Manager" },
  { value: "finance",      label: "Finance" },
  { value: "team_member",  label: "Team Member" },
  { value: "contractor",   label: "Contractor" },
  { value: "client_viewer",label: "Client Viewer" },
]

const Schema = z.object({
  name:      z.string().min(1, "Name is required"),
  email:     z.string().email("Valid email required"),
  password:  z.string().min(8, "Minimum 8 characters"),
  role:      z.string().min(1, "Role is required"),
  timezone:  z.string().nullable().optional(),
  job_title: z.string().nullable().optional(),
  phone:     z.string().nullable().optional(),
})
type FormData = z.infer<typeof Schema>

const NO_TZ = "__none_tz__"

interface Props {
  onSuccess?: () => void
}

export function OnboardStaffDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", email: "", password: "", role: "", timezone: null, job_title: null, phone: null },
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/bff/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          timezone: data.timezone ?? null,
          job_title: data.job_title || null,
          phone: data.phone || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Error ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      qc.invalidateQueries({ queryKey: ["staff"] })
      form.reset()
      setOpen(false)
      onSuccess?.()
    },
  })

  const watchedTz = form.watch("timezone")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Onboard New Staff Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((d) => mutate(d))} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input {...form.register("name")} placeholder="Jane Smith" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input {...form.register("email")} type="email" placeholder="jane@example.com" />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label>Password *</Label>
            <Input {...form.register("password")} type="password" placeholder="Min 8 characters" />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select
              value={form.watch("role") ?? ""}
              onValueChange={(v) => form.setValue("role", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-xs text-destructive">{form.formState.errors.role.message}</p>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select
              value={watchedTz ?? NO_TZ}
              onValueChange={(v) => form.setValue("timezone", v === NO_TZ ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone (optional)" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_TZ}>
                  <span className="text-muted-foreground">None</span>
                </SelectItem>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Job Title */}
          <div className="space-y-1.5">
            <Label>Job Title</Label>
            <Input {...form.register("job_title")} placeholder="e.g. Project Manager" />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...form.register("phone")} type="tel" placeholder="+1 (555) 000-0000" />
          </div>

          {error && (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
