// apps/web/src/app/api/bff/clients/[id]/contacts/route.ts
// BFF Route Handler — POST contact to client

import { auth } from "@/auth"
import { apiCreateContact } from "@/lib/api-client"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const result = await apiCreateContact(session.user.token, params.id, body)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
