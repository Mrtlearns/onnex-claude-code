// apps/web/src/app/api/bff/clients/[id]/route.ts
// BFF Route Handler — proxy for single Client GET + PATCH mutations

import { auth } from "@/auth"
import { apiGetClient, apiPatchClient, apiArchiveClient } from "@/lib/api-client"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const client = await apiGetClient(session.user.token, params.id)
    return NextResponse.json(client)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const result = await apiPatchClient(session.user.token, params.id, body)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
