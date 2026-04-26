// apps/web/src/app/api/bff/plane/projects/route.ts
// BFF: GET list of / POST create Plane projects
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"
import type { PlaneProject } from "@/types/api"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const projects = await apiFetch<PlaneProject[]>("/api/v1/plane/projects", session.user.token)
    return NextResponse.json(projects)
  } catch (err: any) {
    const msg: string = err.message ?? ""
    if (msg.toLowerCase().includes("unauthorized") || msg.includes("401"))
      return NextResponse.json({ error: "Plane token not configured or invalid" }, { status: 401 })
    if (msg.includes("400"))
      return NextResponse.json({ error: "Plane workspace slug not configured — set it in Settings → Integrations" }, { status: 400 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await req.json()
    const data = await apiFetch("/api/v1/plane/projects", session.user.token, {
      method: "POST",
      body: JSON.stringify(body),
    })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    const isUnauth = err.message?.includes("401") || err.message?.toLowerCase().includes("unauthorized")
    const status = isUnauth ? 401 : 500
    const error = isUnauth ? "Plane token not configured or invalid" : err.message
    return NextResponse.json({ error }, { status })
  }
}
