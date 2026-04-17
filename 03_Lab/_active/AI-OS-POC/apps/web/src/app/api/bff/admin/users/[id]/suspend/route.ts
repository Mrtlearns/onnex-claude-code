// apps/web/src/app/api/bff/admin/users/[id]/suspend/route.ts
// BFF proxy: POST /api/v1/admin/users/:id/suspend

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiSuspendUser } from "@/lib/api-client"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await apiSuspendUser(session.user.token, params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to suspend user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
