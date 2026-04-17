// apps/web/src/app/api/bff/portal/invoices/route.ts
// BFF proxy: GET client's invoices with PDF download URLs

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetPortalInvoices } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await apiGetPortalInvoices(session.user.token)
  return NextResponse.json(data)
}
