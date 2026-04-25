// apps/web/src/app/api/bff/settings/plane/route.ts
// BFF: GET + PUT workspace-level Plane settings
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const data = await apiFetch("/api/v1/settings/plane", session.user.token)
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const data = await apiFetch("/api/v1/settings/plane", session.user.token, {
    method: "PUT",
    body: JSON.stringify(body),
  })
  return NextResponse.json(data)
}
