// apps/web/src/app/api/bff/admin/invite/route.ts
// BFF proxy: POST /api/v1/admin/invite

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiInviteUser } from "@/lib/api-client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const result = await apiInviteUser(session.user.token, body)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to invite user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
