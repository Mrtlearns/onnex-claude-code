// BFF: GET/PATCH /api/v1/me/profile
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetMyProfile, apiPatchMyProfile } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const profile = await apiGetMyProfile(session.user.token)
    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await req.json()
    const profile = await apiPatchMyProfile(session.user.token, body)
    return NextResponse.json(profile)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update profile"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
