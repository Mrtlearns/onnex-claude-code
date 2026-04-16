// apps/web/src/app/api/bff/projects/[id]/archive/route.ts
// BFF Route Handler — archive a project (soft delete)

import { auth } from "@/auth"
import { apiArchiveProject } from "@/lib/api-client"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await apiArchiveProject(session.user.token, params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
