"use client"
// My Profile tab — self-service: display_name, avatar, timezone, title, phone

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload } from "lucide-react"
import { TIMEZONES } from "@/lib/timezones"
import type { UserProfile } from "@/types/api"

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

export function ProfileSettingsForm() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["my-profile"],
    queryFn: () => fetch("/api/bff/me/profile").then((r) => r.json()),
    staleTime: 60_000,
  })

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    values: profile
      ? {
          display_name: profile.display_name,
          timezone:     profile.timezone ?? null,
          job_title:    profile.job_title ?? null,
          phone:        profile.phone ?? null,
        }
      : undefined,
  })

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/bff/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          timezone:  data.timezone ?? null,
          job_title: data.job_title || null,
          phone:     data.phone || null,
        }),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      return res.json() as Promise<UserProfile>
    },
    onSuccess: (updated) => {
      qc.setQueryData(["my-profile"], updated)
      qc.invalidateQueries({ queryKey: ["staff"] })
    },
  })

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("avatar", file)
      const res = await fetch("/api/bff/me/avatar", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Upload failed (${res.status})`)
      }
      const { avatar_url } = await res.json() as { avatar_url: string }
      qc.setQueryData<UserProfile>(["my-profile"], (prev) =>
        prev ? { ...prev, avatar_url } : prev,
      )
      qc.invalidateQueries({ queryKey: ["staff"] })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const watchedTz = form.watch("timezone")

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-muted rounded" />
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Avatar */}
      <div className="space-y-2">
        <Label>Profile Photo</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg">
              {profile ? initials(profile.display_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
            <p className="text-xs text-muted-foreground">JPEG or PNG — auto-resized to 256×256</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      </div>

      <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label>Display Name *</Label>
          <Input {...form.register("display_name")} placeholder="Your full name" />
          {form.formState.errors.display_name && (
            <p className="text-xs text-destructive">{form.formState.errors.display_name.message}</p>
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
              <SelectValue placeholder="Select your timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NO_TZ}>
                <span className="text-muted-foreground">Not set</span>
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
          <Input {...form.register("job_title")} placeholder="e.g. Account Manager" />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input {...form.register("phone")} type="tel" placeholder="+1 (555) 000-0000" />
        </div>

        {saveMutation.isError && (
          <p className="text-sm text-destructive">
            {(saveMutation.error as Error).message}
          </p>
        )}
        {saveMutation.isSuccess && (
          <p className="text-sm text-green-600">Profile saved.</p>
        )}

        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </div>
  )
}
