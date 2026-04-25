"use client"
// apps/web/src/app/(protected)/projects/[id]/components/plane-link-dialog.tsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { PlaneProject } from "@/types/api"

interface PlaneLinkDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlaneLinkDialog({ projectId, open, onOpenChange }: PlaneLinkDialogProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string>("")

  const { data: planeProjects = [], isLoading, error } = useQuery<PlaneProject[]>({
    queryKey: ["plane-projects"],
    queryFn: () => fetch("/api/bff/plane/projects").then(r => {
      if (!r.ok) throw new Error(r.status === 401 ? "Plane token not configured — add it in Settings → Integrations" : "Failed to load Plane projects")
      return r.json()
    }),
    enabled: open,
    staleTime: 60_000,
  })

  const linkMutation = useMutation({
    mutationFn: (planeProjectId: string) => {
      const proj = planeProjects.find(p => p.id === planeProjectId)
      if (!proj) throw new Error("Project not found")
      return fetch(`/api/bff/projects/${projectId}/plane`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plane_project_id: proj.id,
          plane_workspace_slug: proj.workspace_slug,
        }),
      }).then(r => { if (!r.ok) throw new Error("Link failed"); return r.json() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Plane Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Loading Plane projects…</p>
          ) : planeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Plane projects found. Check your token in Settings → Integrations.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Plane Project</Label>
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {planeProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        [{p.identifier}] {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  onClick={() => linkMutation.mutate(selected)}
                  disabled={!selected || linkMutation.isPending}
                >
                  {linkMutation.isPending ? "Linking…" : "Link"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
