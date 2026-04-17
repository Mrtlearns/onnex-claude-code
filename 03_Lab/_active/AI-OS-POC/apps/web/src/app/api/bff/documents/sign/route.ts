// apps/web/src/app/api/bff/documents/sign/route.ts
// BFF proxy: document signing requests → aios-api /api/v1/documents/sign

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const search = request.nextUrl.search
  const res = await fetch(`${AIOS_API}/api/v1/documents/sign${search}`, {
    headers: {
      Authorization: `Bearer ${session.user.token}`,
      "Content-Type": "application/json",
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const res = await fetch(`${AIOS_API}/api/v1/documents/sign`, {
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
