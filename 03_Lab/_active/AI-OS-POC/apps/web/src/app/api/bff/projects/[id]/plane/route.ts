// apps/web/src/app/api/bff/projects/[id]/plane/route.ts
// BFF: GET + PATCH project plane link fields
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const project = await apiFetch<Record<string, unknown>>(`/api/v1/projects/${params.id}`, session.user.token)
  return NextResponse.json({
    plane_project_id: project.plane_project_id ?? null,
    plane_workspace_slug: project.plane_workspace_slug ?? null,
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const data = await apiFetch(`/api/v1/projects/${params.id}`, session.user.token, {
    method: "PATCH",
    body: JSON.stringify({
      plane_project_id: body.plane_project_id ?? null,
      plane_workspace_slug: body.plane_workspace_slug ?? null,
    }),
  })
  return NextResponse.json(data)
}
