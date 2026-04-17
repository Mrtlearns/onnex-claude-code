// apps/web/src/app/api/bff/settings/workspace/route.ts
// BFF proxy: GET + PATCH /api/v1/settings/workspace

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetWorkspaceSettings, apiUpdateWorkspaceSettings } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const data = await apiGetWorkspaceSettings(session.user.token)
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  const data = await apiUpdateWorkspaceSettings(session.user.token, body)
  return NextResponse.json(data)
}
