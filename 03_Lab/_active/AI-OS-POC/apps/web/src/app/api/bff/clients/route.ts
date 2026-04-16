// apps/web/src/app/api/bff/clients/route.ts
// BFF Route Handler — proxy for Client Component create/list mutations
// Client Components cannot call aios-api directly (CORS + server-only token guard)

import { auth } from "@/auth"
import { apiCreateClient, apiGetClients } from "@/lib/api-client"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const params: Record<string, string | undefined> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  try {
    const clients = await apiGetClients(session.user.token, params)
    return NextResponse.json(clients)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const result = await apiCreateClient(session.user.token, body)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
