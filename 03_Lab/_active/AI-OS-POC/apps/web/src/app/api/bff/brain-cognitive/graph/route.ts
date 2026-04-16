// BFF route: brain-cognitive/graph
// Proxies GET /api/v1/rag/nextcloud/graph → returns { entities, links }
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.

import { auth }     from "@/auth"
import { apiFetch } from "@/lib/api-client"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const qs = searchParams.toString()
    const data = await apiFetch(
      `/api/v1/rag/nextcloud/graph${qs ? `?${qs}` : ""}`,
      session.user.token,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
