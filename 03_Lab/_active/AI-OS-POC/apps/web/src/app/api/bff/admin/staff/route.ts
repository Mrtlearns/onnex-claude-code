// BFF: POST /api/v1/admin/staff — create staff member
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiCreateStaff } from "@/lib/api-client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await req.json()
    const result = await apiCreateStaff(session.user.token, body)
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create staff member"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
