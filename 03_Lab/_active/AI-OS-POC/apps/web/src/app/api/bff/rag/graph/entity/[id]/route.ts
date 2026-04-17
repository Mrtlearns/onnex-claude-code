// apps/web/src/app/api/bff/rag/graph/entity/[id]/route.ts
// BFF proxy: GET /api/v1/rag/nextcloud/graph/entity/:id

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"
import type { KgEntityDetail } from "@/types/api"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await apiFetch<KgEntityDetail>(
      `/api/v1/rag/nextcloud/graph/entity/${params.id}`,
      session.user.token,
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "KG unavailable"
    const status = message.includes("404") ? 404 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
