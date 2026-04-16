// apps/web/src/app/api/bff/invoices/[id]/status/route.ts
// BFF proxy: PATCH invoice status (paid, void, etc.) with optional paid_at

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiPatchInvoiceStatus } from "@/lib/api-client"

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
