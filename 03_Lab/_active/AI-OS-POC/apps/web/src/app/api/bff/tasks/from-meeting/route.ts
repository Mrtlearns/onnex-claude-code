import { auth } from "@/auth"
import { NextResponse } from "next/server"

const API_BASE = process.env.AIOS_API_INTERNAL_URL ?? "http://api:3001"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const res = await fetch(`${API_BASE}/api/v1/tasks/from-meeting`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.user.token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
