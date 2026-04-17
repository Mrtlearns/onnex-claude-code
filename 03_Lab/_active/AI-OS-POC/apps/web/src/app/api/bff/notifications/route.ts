// apps/web/src/app/api/bff/notifications/route.ts
// BFF proxy: GET /api/v1/notifications — passes ?unread_only=true and other query params through

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(`${API}/api/v1/notifications${request.nextUrl.search}`, {
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  const data = await res.json()
  return NextResponse.json(data.notifications ?? [], { status: res.status })
}
