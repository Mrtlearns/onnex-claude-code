// apps/web/src/app/api/bff/time-entries/weekly-summary/route.ts
// BFF proxy for weekly summary — passes user_id=me and week_start through

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetWeeklySummary } from "@/lib/api-client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user_id = req.nextUrl.searchParams.get("user_id") ?? "me"
  const week_start = req.nextUrl.searchParams.get("week_start") ?? ""
  const summary = await apiGetWeeklySummary(session.user.token, { user_id, week_start })
  return NextResponse.json(summary)
}
