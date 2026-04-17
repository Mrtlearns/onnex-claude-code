// apps/web/src/app/api/bff/ai/memory/route.ts
// BFF proxy: GET /api/v1/ai/memory/stats | DELETE /api/v1/ai/memory

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetAiMemoryStats, apiClearAiMemory } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = await apiGetAiMemoryStats(session.user.token)
    return NextResponse.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch AI memory stats"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await apiClearAiMemory(session.user.token)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear AI memory"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
