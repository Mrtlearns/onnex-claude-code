// apps/web/src/app/api/bff/projects/[id]/activity/route.ts
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const res = await fetch(`${AIOS_API}/api/v1/projects/${id}/activity`, {
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
