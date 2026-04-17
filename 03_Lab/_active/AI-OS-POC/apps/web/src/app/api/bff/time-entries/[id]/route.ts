// apps/web/src/app/api/bff/time-entries/[id]/route.ts
// BFF proxy for time entry edit + delete

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiPatchTimeEntry, apiDeleteTimeEntry } from "@/lib/api-client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const entry = await apiPatchTimeEntry(session.user.token, id, body)
  return NextResponse.json(entry)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  await apiDeleteTimeEntry(session.user.token, id)
  return new NextResponse(null, { status: 204 })
}
