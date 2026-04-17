// apps/web/src/app/api/bff/admin/audit-log/route.ts
// BFF proxy: GET /api/v1/admin/audit-log

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetAuditLog } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const entries = await apiGetAuditLog(session.user.token)
    return NextResponse.json(entries)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch audit log"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
