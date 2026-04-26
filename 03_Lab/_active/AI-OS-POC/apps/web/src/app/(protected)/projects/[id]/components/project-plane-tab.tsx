"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-plane-tab.tsx

import { Button } from "@/components/ui/button"
import { ExternalLink, RefreshCw } from "lucide-react"
import { useState } from "react"
import type { Project } from "@/types/api"

interface ProjectPlaneTabProps {
  project: Project
  active: boolean
}

export function ProjectPlaneTab({ project }: ProjectPlaneTabProps) {
  const [key, setKey] = useState(0)
  const planeUrl = `https://plane.on-nex.us/${project.plane_workspace_slug}/projects/${project.plane_project_id}/issues/`

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
      <div className="flex items-center justify-between pb-2 shrink-0">
        <span className="text-sm font-medium text-muted-foreground">
          {project.plane_project_name ?? project.plane_workspace_slug}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setKey(k => k + 1)} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={planeUrl} target="_blank" rel="noopener noreferrer">
              Open in Plane <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
      <iframe
        key={key}
        src={planeUrl}
        className="flex-1 w-full rounded-md border border-border"
        style={{ minHeight: 0 }}
        title={`Plane — ${project.plane_project_name ?? "Project"}`}
        allow="clipboard-write"
      />
    </div>
  )
}
