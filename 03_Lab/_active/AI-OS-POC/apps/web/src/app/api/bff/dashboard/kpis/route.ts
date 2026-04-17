// apps/web/src/app/api/bff/dashboard/kpis/route.ts
// BFF proxy: GET /api/v1/dashboard/kpis — proxies with Bearer token from session

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const res = await fetch(`${API}/api/v1/dashboard/kpis`, {
      headers: { Authorization: `Bearer ${session.user.token}` },
    })
    if (!res.ok) {
      return NextResponse.json({ active_projects_count: 0 }, { status: 200 })
    }
    const data = await res.json()
    return NextResponse.json(data.kpis ?? data ?? { active_projects_count: 0 }, { status: 200 })
  } catch {
    return NextResponse.json({ active_projects_count: 0 }, { status: 200 })
  }
}
