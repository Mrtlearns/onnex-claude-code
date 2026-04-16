// apps/web/src/app/api/bff/projects/[id]/route.ts
// BFF Route Handler — proxy for single Project GET + PATCH mutations

import { auth } from "@/auth"
import { apiGetProject, apiPatchProject } from "@/lib/api-client"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const project = await apiGetProject(session.user.token, params.id)
    return NextResponse.json(project)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const result = await apiPatchProject(session.user.token, params.id, body)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
