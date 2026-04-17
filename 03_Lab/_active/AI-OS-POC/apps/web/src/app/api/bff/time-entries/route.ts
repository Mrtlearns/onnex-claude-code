// apps/web/src/app/api/bff/time-entries/route.ts
// BFF proxy for time entries list + create

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetTimeEntries, apiCreateTimeEntry } from "@/lib/api-client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const entries = await apiGetTimeEntries(session.user.token, searchParams)
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const entry = await apiCreateTimeEntry(session.user.token, body)
  return NextResponse.json(entry, { status: 201 })
}
