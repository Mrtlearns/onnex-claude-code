// apps/web/src/app/api/bff/portal/projects/route.ts
// BFF proxy: GET client's active projects with task completion summary

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetPortalProjects } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await apiGetPortalProjects(session.user.token)
  return NextResponse.json(data)
}
