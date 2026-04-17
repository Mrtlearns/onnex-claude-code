// apps/web/src/app/api/bff/tasks/route.ts
// BFF proxy: GET /api/v1/tasks — proxies with Bearer token from session

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const qs = request.nextUrl.search
  const isGantt = request.nextUrl.searchParams.get("view") === "gantt"
  try {
    const res = await fetch(`${API}/api/v1/tasks${qs}`, {
      headers: { Authorization: `Bearer ${session.user.token}` },
    })
    if (!res.ok) return NextResponse.json(isGantt ? { tasks: [], dependencies: [] } : [], { status: 200 })
    const data = await res.json()
    // For gantt view, pass through the full { tasks, dependencies } shape from the API
    if (isGantt) {
      return NextResponse.json(
        Array.isArray(data) ? { tasks: data, dependencies: [] } : { tasks: data.tasks ?? [], dependencies: data.dependencies ?? [] },
        { status: 200 }
      )
    }
    return NextResponse.json(Array.isArray(data) ? data : (data.tasks ?? []), { status: 200 })
  } catch {
    return NextResponse.json(isGantt ? { tasks: [], dependencies: [] } : [], { status: 200 })
  }
}
