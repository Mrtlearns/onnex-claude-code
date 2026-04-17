// apps/web/src/app/api/bff/portal/documents/route.ts
// BFF proxy: GET client's linked documents (paperless + nextcloud)

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetPortalDocuments } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await apiGetPortalDocuments(session.user.token)
  return NextResponse.json(data)
}
