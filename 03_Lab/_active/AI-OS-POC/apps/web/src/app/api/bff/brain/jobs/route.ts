// apps/web/src/app/api/bff/brain/jobs/route.ts
// BFF GET — proxy brain job runs from aios-api

import { auth } from "@/auth"
import { NextResponse } from "next/server"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const res = await fetch(`${AIOS_API}/api/v1/brain/jobs`, {
      headers: {
        Authorization: `Bearer ${session.user.token}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "API unavailable" }, { status: 503 })
  }
}
