// apps/web/src/app/api/bff/settings/integrations/route.ts
// BFF proxy: GET /api/v1/settings/integrations

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetIntegrations } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const data = await apiGetIntegrations(session.user.token)
  return NextResponse.json(data)
}
