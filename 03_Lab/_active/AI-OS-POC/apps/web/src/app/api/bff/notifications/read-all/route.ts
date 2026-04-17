// apps/web/src/app/api/bff/notifications/read-all/route.ts
// BFF proxy: PATCH /api/v1/notifications/read-all — marks all notifications read
// IMPORTANT: This static segment MUST be registered before [id]/ to avoid capture by dynamic route

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function PATCH(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(`${API}/api/v1/notifications/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
