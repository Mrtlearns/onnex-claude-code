import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiConvertDealToInvoice } from "@/lib/api-client"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const invoice = await apiConvertDealToInvoice(session.user.token, id)
  return NextResponse.json(invoice, { status: 201 })
}
