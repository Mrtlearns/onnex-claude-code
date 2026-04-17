// apps/web/src/app/api/bff/settings/n8n/route.ts
// BFF proxy: GET + PATCH /api/v1/settings/n8n

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetN8nConfig, apiUpdateN8nConfig } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const data = await apiGetN8nConfig(session.user.token)
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  const data = await apiUpdateN8nConfig(session.user.token, body)
  return NextResponse.json(data)
}
