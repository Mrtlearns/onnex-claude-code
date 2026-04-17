// apps/web/src/app/api/bff/integrations/config/route.ts
// BFF proxy: GET /api/v1/integrations/config — returns webhook URLs and env var names

import { auth } from "@/auth"
import { NextResponse } from "next/server"

const API_BASE = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await fetch(`${API_BASE}/api/v1/integrations/config`, {
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  const data = await res.json()
  return NextResponse.json(data)
}
