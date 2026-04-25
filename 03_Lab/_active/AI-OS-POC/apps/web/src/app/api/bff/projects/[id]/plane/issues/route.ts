// apps/web/src/app/api/bff/projects/[id]/plane/issues/route.ts
// BFF: GET live Plane issues for a linked AI-OS project
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-client"
import type { PlaneIssue } from "@/types/api"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const issues = await apiFetch<PlaneIssue[]>(`/api/v1/projects/${params.id}/plane/issues`, session.user.token)
    return NextResponse.json(issues)
  } catch (err: any) {
    const status = err.message?.includes("401") ? 401 : err.message?.includes("404") ? 404 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
