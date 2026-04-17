// apps/web/src/app/api/bff/invoices/[id]/route.ts
// BFF proxy: GET invoice detail + PATCH edit

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetInvoice, apiPatchInvoiceStatus } from "@/lib/api-client"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const invoice = await apiGetInvoice(session.user.token, id)
  return NextResponse.json(invoice)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const invoice = await apiPatchInvoiceStatus(session.user.token, id, body)
  return NextResponse.json(invoice)
}
