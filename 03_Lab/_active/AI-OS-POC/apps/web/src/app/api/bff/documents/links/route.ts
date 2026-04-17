// apps/web/src/app/api/bff/documents/links/route.ts
// BFF proxy: GET/POST document links → aios-api /document-links endpoints

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API =
  process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Forward query params (e.g., ?entity_type=deal&entity_id=xxx)
  const search = request.nextUrl.search
  const res = await fetch(
    `${AIOS_API}/api/v1/document-links${search}`,
    {
      headers: {
        Authorization: `Bearer ${session.user.token}`,
        "Content-Type": "application/json",
      },
    },
  )

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const res = await fetch(`${AIOS_API}/api/v1/document-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.user.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
