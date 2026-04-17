// apps/web/src/app/api/bff/invoices/[id]/time-entries/route.ts
// BFF proxy: GET unbilled time entries for T&M line item population
// Accepts ?project_id=X query param — returns unbilled entries for that project

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetInvoiceTimeEntries } from "@/lib/api-client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const projectId = req.nextUrl.searchParams.get("project_id")

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 })
  }

  const entries = await apiGetInvoiceTimeEntries(session.user.token, id, projectId)
  return NextResponse.json(entries)
}
