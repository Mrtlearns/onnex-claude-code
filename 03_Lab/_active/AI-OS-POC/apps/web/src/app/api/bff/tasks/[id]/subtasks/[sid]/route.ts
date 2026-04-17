import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API_BASE = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, sid } = await params
  const body = await req.json()
  const res = await fetch(`${API_BASE}/api/v1/tasks/${id}/subtasks/${sid}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${session.user.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
