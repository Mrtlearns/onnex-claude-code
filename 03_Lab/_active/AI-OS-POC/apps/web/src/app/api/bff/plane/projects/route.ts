// apps/web/src/app/api/bff/plane/projects/route.ts
// BFF: GET list of Plane projects for link UI
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
