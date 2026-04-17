// apps/web/src/app/api/bff/rag/chat/route.ts
// BFF proxy: POST /api/v1/rag/nextcloud/chat

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"
import type { RagChatResponse } from "@/types/api"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { query, scope, top_k } = body
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 })
    }

    const result = await apiFetch<RagChatResponse>(
      "/api/v1/rag/nextcloud/chat",
      session.user.token,
      { method: "POST", body: JSON.stringify({ query: query.trim(), scope, top_k }) },
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "RAG unavailable"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
