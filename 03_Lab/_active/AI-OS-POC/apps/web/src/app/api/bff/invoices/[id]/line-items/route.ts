// apps/web/src/app/api/bff/invoices/[id]/line-items/route.ts
// BFF proxy: GET line items list + POST create line item

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiCreateLineItem } from "@/lib/api-client"

const API_BASE = process.env.AIOS_API_URL ?? "http://aios-api:3000"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const res = await fetch(`${API_BASE}/api/v1/invoices/${id}/line-items`, {
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch line items" }, { status: res.status })
  }
  const data = await res.json()
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const lineItem = await apiCreateLineItem(session.user.token, id, body)
  return NextResponse.json(lineItem, { status: 201 })
}
