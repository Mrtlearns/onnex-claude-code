// apps/web/src/app/api/bff/brain/sops/[id]/route.ts
// BFF: PATCH (update) + DELETE SOPs

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const res = await fetch(`${AIOS_API}/api/v1/brain/sops/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${session.user.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const res = await fetch(`${AIOS_API}/api/v1/brain/sops/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
