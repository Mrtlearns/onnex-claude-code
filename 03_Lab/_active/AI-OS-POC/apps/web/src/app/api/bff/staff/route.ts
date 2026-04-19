// BFF: GET /api/v1/staff — people-picker
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetStaff } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const staff = await apiGetStaff(session.user.token)
    return NextResponse.json(staff)
  } catch {
    return NextResponse.json([])
  }
}
