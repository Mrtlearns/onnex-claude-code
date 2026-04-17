// apps/web/src/app/api/bff/admin/users/[id]/role/route.ts
// BFF proxy: PATCH /api/v1/admin/users/:id/role

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiPatchUserRole } from "@/lib/api-client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    await apiPatchUserRole(session.user.token, params.id, body.role)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
