// apps/web/src/app/api/bff/me/integrations/route.ts
// BFF: GET + PATCH /api/v1/me/profile (plane_api_token field)
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await apiFetch<Record<string, unknown>>("/api/v1/me/profile", session.user.token)
  return NextResponse.json({
    plane_api_token: profile.plane_api_token ? "********" : null,
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const data = await apiFetch("/api/v1/me/profile", session.user.token, {
    method: "PATCH",
    body: JSON.stringify({ plane_api_token: body.plane_api_token ?? null }),
  })
  return NextResponse.json(data)
}
