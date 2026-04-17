// apps/web/src/app/api/bff/invoices/[id]/send/route.ts
// BFF proxy: POST send invoice — triggers PDF generation + SMTP email on aios-api

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiSendInvoice } from "@/lib/api-client"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const result = await apiSendInvoice(session.user.token, id)
  return NextResponse.json(result)
}
