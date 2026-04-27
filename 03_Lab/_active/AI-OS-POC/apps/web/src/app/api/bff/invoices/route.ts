// apps/web/src/app/api/bff/invoices/route.ts
// BFF proxy: GET invoice list + POST create invoice

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetInvoices, apiCreateInvoice } from "@/lib/api-client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  try {
    const invoices = await apiGetInvoices(session.user.token, searchParams)
    return NextResponse.json(invoices)
  } catch (err: any) {
    const status = err?.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json([], { status })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const invoice = await apiCreateInvoice(session.user.token, body)
  return NextResponse.json(invoice, { status: 201 })
}
