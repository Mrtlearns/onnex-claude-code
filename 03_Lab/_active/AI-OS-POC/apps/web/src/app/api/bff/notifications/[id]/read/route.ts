// apps/web/src/app/api/bff/notifications/[id]/read/route.ts
// BFF proxy: PATCH /api/v1/notifications/:id/read — marks a single notification as read

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(`${API}/api/v1/notifications/${params.id}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
