// apps/web/src/app/api/bff/documents/comments/route.ts
// BFF proxy: GET/POST document comments → aios-api /document-comments endpoints

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API =
  process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const search = request.nextUrl.search
  const res = await fetch(
    `${AIOS_API}/api/v1/document-comments${search}`,
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
  const res = await fetch(`${AIOS_API}/api/v1/document-comments`, {
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
