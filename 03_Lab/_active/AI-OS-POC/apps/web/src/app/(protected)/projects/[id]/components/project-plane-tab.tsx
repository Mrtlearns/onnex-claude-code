"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-plane-tab.tsx

import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import type { PlaneIssue, Project } from "@/types/api"

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/30",
  high:   "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  none:   "bg-muted text-muted-foreground",
}

const STATE_GROUP_STYLES: Record<string, string> = {
  completed:  "bg-green-500/15 text-green-400",
  cancelled:  "bg-muted text-muted-foreground line-through",
  started:    "bg-blue-500/15 text-blue-400",
  unstarted:  "bg-muted text-muted-foreground",
  backlog:    "bg-muted text-muted-foreground",
}

interface ProjectPlaneTabProps {
  project: Project
  active: boolean
}

export function ProjectPlaneTab({ project, active }: ProjectPlaneTabProps) {
  const planeBaseUrl = `https://plane.on-nex.us/${project.plane_workspace_slug}/projects/${project.plane_project_id}/issues/`

  const { data: issues, isLoading, error } = useQuery<PlaneIssue[]>({
    queryKey: ["plane-issues", project.id],
    queryFn: () =>
      fetch(`/api/bff/projects/${project.id}/plane/issues`).then(r => {
        if (r.status === 401) throw new Error("token_missing")
        if (!r.ok) throw new Error(`Error ${r.status}`)
        return r.json()
      }),
    enabled: active && !!project.plane_project_id,
    staleTime: 60_000,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Plane Issues</h3>
        <Button variant="outline" size="sm" asChild>
          <a href={planeBaseUrl} target="_blank" rel="noopener noreferrer">
            Open in Plane <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading issues…</p>
      )}

      {error && (
        <div className="py-8 text-center text-sm">
          {(error as Error).message === "token_missing" ? (
            <p className="text-muted-foreground">
              Plane token not configured.{" "}
              <a href="/settings" className="underline text-foreground">
                Add it in Settings → Integrations
              </a>
            </p>
          ) : (
            <p className="text-destructive">{(error as Error).message}</p>
          )}
        </div>
      )}

      {issues && issues.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No issues in the linked Plane project.
        </p>
      )}

      {issues && issues.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-14">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">State</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Priority</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr
                  key={issue.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => window.open(issue.plane_url, "_blank")}
                >
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                    {issue.sequence_id}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{issue.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATE_GROUP_STYLES[issue.state.group] ?? "bg-muted text-muted-foreground"}`}>
                      {issue.state.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${PRIORITY_STYLES[issue.priority] ?? PRIORITY_STYLES.none}`}>
                      {issue.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
