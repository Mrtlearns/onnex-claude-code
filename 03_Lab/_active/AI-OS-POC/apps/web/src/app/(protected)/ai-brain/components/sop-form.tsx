"use client"
// apps/web/src/app/(protected)/ai-brain/components/sop-form.tsx
// Create / edit SOP dialog form

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Sop } from "@/types/api"

interface SopFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sop?: Sop // if provided: edit mode
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function SopForm({ open, onOpenChange, sop }: SopFormProps) {
  const qc = useQueryClient()
  const isEdit = !!sop

  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<Sop["category"]>("operations")
  const [auto, setAuto] = useState(false)
  const [inputLabel, setInputLabel] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")

  // Populate form when opening in edit mode
  useEffect(() => {
    if (open && sop) {
      setTitle(sop.title)
      setSlug(sop.slug)
      setSlugEdited(true)
      setDescription(sop.description)
      setCategory(sop.category)
      setAuto(sop.auto)
      setInputLabel(sop.input_label ?? "")
      setSystemPrompt(sop.system_prompt)
    } else if (open && !sop) {
      setTitle("")
      setSlug("")
      setSlugEdited(false)
      setDescription("")
      setCategory("operations")
      setAuto(false)
      setInputLabel("")
      setSystemPrompt("")
    }
  }, [open, sop])

  // Auto-generate slug from title unless user has edited it manually
  useEffect(() => {
    if (!slugEdited && title) {
      setSlug(slugify(title))
    }
  }, [title, slugEdited])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        category,
        auto,
        input_label: inputLabel.trim() || null,
        system_prompt: systemPrompt.trim(),
      }

      const url = isEdit ? `/api/bff/brain/sops/${sop!.id}` : "/api/bff/brain/sops"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Save failed")
      }

      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-sops"] })
      toast.success(isEdit ? "SOP updated" : "SOP created")
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed")
    },
  })

  const canSubmit = title.trim() && slug.trim() && systemPrompt.trim() && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit SOP" : "New SOP"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Proposal Generator"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Slug</label>
            <Input
              placeholder="proposal-generator"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }}
            />
            <p className="text-xs text-muted-foreground">Used as identifier — auto-generated from title</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="Generates a professional proposal..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={(v) => setCategory(v as Sop["category"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Scheduled</label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sop-auto"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-purple-500"
                />
                <label htmlFor="sop-auto" className="text-sm text-muted-foreground">
                  Auto / scheduled
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Input Label <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              placeholder="Describe the client and project scope"
              value={inputLabel}
              onChange={(e) => setInputLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">If set, shows a text area for user input before running</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">System Prompt</label>
            <Textarea
              placeholder="You are an expert..."
              rows={6}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="resize-none font-mono text-xs"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create SOP"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
