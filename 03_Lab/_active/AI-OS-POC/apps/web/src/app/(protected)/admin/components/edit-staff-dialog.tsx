"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Upload } from "lucide-react"
import { TIMEZONES } from "@/lib/timezones"
import type { StaffMember } from "@/types/api"

const NO_TZ = "__none_tz__"

const Schema = z.object({
  display_name: z.string().min(1, "Name is required"),
  timezone:     z.string().nullable().optional(),
  job_title:    z.string().nullable().optional(),
  phone:        z.string().nullable().optional(),
})
type FormData = z.infer<typeof Schema>

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

interface EditStaffDialogProps {
  member: StaffMember
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function EditStaffDialog({ member, open, onOpenChange }: EditStaffDialogProps) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member.avatar_url)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pwValue, setPwValue] = useState("")
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    values: {
      display_name: member.display_name,
      timezone:     member.timezone ?? null,
      job_title:    member.job_title ?? null,
      phone:        (member as any).phone ?? null,
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch(`/api/bff/admin/staff/${member.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: data.display_name,
          timezone:     data.timezone ?? null,
          job_title:    data.job_title || null,
          phone:        data.phone || null,
        }),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] })
      onOpenChange(false)
    },
  })

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("avatar", file)
      const res = await fetch(`/api/bff/admin/staff/${member.user_id}/avatar`, { method: "POST", body: fd })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      const { avatar_url } = await res.json() as { avatar_url: string }
      setAvatarUrl(avatar_url)
      qc.invalidateQueries({ queryKey: ["staff"] })
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handlePasswordReset() {
    setPwError(null)
    setPwSuccess(false)
    if (pwValue.length < 8) { setPwError("Minimum 8 characters"); return }
    const res = await fetch(`/api/bff/admin/staff/${member.user_id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwValue }),
    })
    if (!res.ok) { setPwError("Password reset failed"); return }
    setPwSuccess(true)
    setPwValue("")
  }

  const watchedTz = form.watch("timezone")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit — {member.display_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Avatar */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Profile Photo</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback>{initials(member.display_name)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Photo"}
                </Button>
                <p className="text-xs text-muted-foreground">Auto-resized to 256×256</p>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarChange} />
            </div>
            {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
          </div>

          {/* Profile form */}
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Display Name *</Label>
              <Input {...form.register("display_name")} />
              {form.formState.errors.display_name && (
                <p className="text-xs text-destructive">{form.formState.errors.display_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Timezone</Label>
              <Select value={watchedTz ?? NO_TZ} onValueChange={(v) => form.setValue("timezone", v === NO_TZ ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NO_TZ}><span className="text-muted-foreground">Not set</span></SelectItem>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Job Title</Label>
                <Input {...form.register("job_title")} placeholder="e.g. Account Manager" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Phone</Label>
                <Input {...form.register("phone")} type="tel" placeholder="+1 (555) 000-0000" />
              </div>
            </div>

            {saveMutation.isError && <p className="text-sm text-destructive">{(saveMutation.error as Error).message}</p>}

            <Button type="submit" disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </form>

          {/* Password reset */}
          <div className="border-t pt-4 space-y-2">
            <Label className="text-sm font-medium">Reset Password</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="New password (min 8 chars)"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={handlePasswordReset}>
                Set Password
              </Button>
            </div>
            {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-600">Password updated.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
