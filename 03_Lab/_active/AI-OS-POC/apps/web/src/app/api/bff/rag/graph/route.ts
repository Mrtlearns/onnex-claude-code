// apps/web/src/app/api/bff/rag/graph/route.ts
// BFF proxy: GET /api/v1/rag/nextcloud/graph

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"
import type { KgEntity, KgLink } from "@/types/api"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = request.nextUrl
    const qs = searchParams.toString()
    const path = qs ? `/api/v1/rag/nextcloud/graph?${qs}` : "/api/v1/rag/nextcloud/graph"

    const result = await apiFetch<{ entities: KgEntity[]; links: KgLink[] }>(path, session.user.token)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "KG unavailable"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
