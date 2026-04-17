// apps/web/src/app/api/bff/portal/me/route.ts
// BFF proxy: GET portal client identity (name, client_id)

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetPortalMe } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await apiGetPortalMe(session.user.token)
  return NextResponse.json(data)
}
