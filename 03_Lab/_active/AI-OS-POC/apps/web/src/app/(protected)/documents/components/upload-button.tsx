"use client"
// apps/web/src/app/(protected)/documents/components/upload-button.tsx
// Sheet-based file upload — POST to /api/bff/documents/upload (BFF forwards to aios-api)

import { useState, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadIcon } from "lucide-react"
import { toast } from "sonner"
import type { DocumentEntityType } from "@/types/api"

export function UploadButton() {
  const [open, setOpen] = useState(false)
  const [entityType, setEntityType] = useState<DocumentEntityType | "">("")
  const [entityId, setEntityId] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.error("Please select a file")
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    if (entityType) formData.append("entity_type", entityType)
    if (entityId.trim()) formData.append("entity_id", entityId.trim())

    try {
      setUploading(true)
      const res = await fetch("/api/bff/documents/upload", {
        method: "POST",
        body: formData,
        // No Content-Type header — fetch auto-sets multipart/form-data boundary
      })

      if (res.status === 202) {
        toast.success("Document uploaded — processing in background")
        setOpen(false)
        setEntityType("")
        setEntityId("")
        if (fileRef.current) fileRef.current.value = ""
        // Delay invalidation to allow Temporal workflow to ingest + index
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["paperless-documents"] })
        }, 3000)
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Upload failed")
      }
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-2">
          <UploadIcon className="h-4 w-4" />
          Upload Document
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Upload Document</SheetTitle>
          <SheetDescription>
            Select a file to upload. The document will be ingested and indexed in Paperless-ngx.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {/* File input */}
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <input
              id="file"
              ref={fileRef}
              type="file"
              accept="*/*"
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          {/* Optional: link to entity */}
          <div className="space-y-2">
            <Label htmlFor="entity_type">Link to (optional)</Label>
            <Select value={entityType} onValueChange={(v) => setEntityType(v as DocumentEntityType | "")}>
              <SelectTrigger id="entity_type">
                <SelectValue placeholder="No link" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="deal">Deal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {entityType && (
            <div className="space-y-2">
              <Label htmlFor="entity_id">Entity ID</Label>
              <Input
                id="entity_id"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="UUID of the client / project / deal"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
