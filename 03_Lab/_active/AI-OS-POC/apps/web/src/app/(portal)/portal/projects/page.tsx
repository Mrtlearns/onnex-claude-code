// apps/web/src/app/(portal)/projects/page.tsx
// Client portal: read-only project list with task completion summary

import { auth } from "@/auth"
import { apiGetPortalProjects } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function PortalProjectsPage() {
  const session = await auth()
  let projects: Awaited<ReturnType<typeof apiGetPortalProjects>>["projects"] = []
  try {
    const data = await apiGetPortalProjects(session!.user.token)
    projects = data.projects
  } catch {
    // No portal mapping — show empty state
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Your Projects</h2>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">No active projects found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge>{p.status}</Badge>
                {p.start_date && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Started {p.start_date}
                  </p>
                )}
                {p.end_date && (
                  <p className="text-xs text-muted-foreground">
                    Due {p.end_date}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Tasks: {p.tasks_done}/{p.tasks_total} complete
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
