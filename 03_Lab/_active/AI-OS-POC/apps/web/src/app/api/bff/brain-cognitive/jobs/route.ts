// BFF route: brain-cognitive/jobs
// Proxies GET /api/v1/brain/jobs → returns BrainJobRun[]
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.

import { auth }     from "@/auth"
import { apiFetch } from "@/lib/api-client"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const data = await apiFetch("/api/v1/brain/jobs", session.user.token)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
