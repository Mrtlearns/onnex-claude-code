// apps/web/src/app/api/bff/ai/chat/route.ts
// BFF proxy: POST /api/v1/ai/chat

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiAiChat } from "@/lib/api-client"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const query: string = body?.query
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 })
    }

    const result = await apiAiChat(session.user.token, query.trim())
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI unavailable"
    // Surface 502 for upstream AI failures
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
