// apps/web/src/app/api/bff/projects/[id]/notes/[noteId]/route.ts
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, noteId } = await params
  const res = await fetch(`${AIOS_API}/api/v1/projects/${id}/notes/${noteId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
