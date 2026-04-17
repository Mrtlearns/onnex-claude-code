// apps/web/src/app/api/bff/admin/users/route.ts
// BFF proxy: GET /api/v1/admin/users

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetAdminUsers } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const users = await apiGetAdminUsers(session.user.token)
    const list = Array.isArray(users) ? users : (users as any).users ?? []
    return NextResponse.json(list)
  } catch {
    return NextResponse.json([])
  }
}
