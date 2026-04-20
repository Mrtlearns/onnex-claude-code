// BFF: POST /api/bff/admin/staff/:id/password — admin resets user password
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API = process.env.API_INTERNAL_URL ?? "http://aios-api:3001"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { password } = await req.json()
  const res = await fetch(`${API}/api/v1/admin/staff/${params.id}/set-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.user.token}`,
    },
    body: JSON.stringify({ password }),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
