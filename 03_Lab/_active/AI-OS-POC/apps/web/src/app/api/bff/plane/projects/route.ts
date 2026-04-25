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
    const status = err.message?.includes("401") ? 401 : 500
    return NextResponse.json({ error: err.message }, { status })
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
    const status = err.message?.includes("401") ? 401 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
