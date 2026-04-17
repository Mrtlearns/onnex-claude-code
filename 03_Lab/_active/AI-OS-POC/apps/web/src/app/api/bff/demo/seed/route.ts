// apps/web/src/app/api/bff/demo/seed/route.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

const API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function POST() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const res = await fetch(`${API}/api/v1/demo/seed`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  const data = await res.json().catch(() => ({ error: "Invalid response" }))
  return NextResponse.json(data, { status: res.status })
}
