// BFF: PATCH /api/v1/admin/staff/:id — admin update staff profile fields
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiPatchStaff } from "@/lib/api-client"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await req.json()
    await apiPatchStaff(session.user.token, params.id, body)
    return NextResponse.json({ updated: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update staff"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
