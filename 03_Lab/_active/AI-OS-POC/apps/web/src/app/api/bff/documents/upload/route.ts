// apps/web/src/app/api/bff/documents/upload/route.ts
// BFF proxy: POST multipart upload → forwards to aios-api /documents/upload with Bearer token
// Returns 202 with workflowRunId from Temporal

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API =
  process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()

  // Forward multipart FormData to aios-api — do NOT set Content-Type manually
  // (fetch sets the correct multipart/form-data boundary automatically)
  const res = await fetch(`${AIOS_API}/api/v1/documents/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.user.token}`,
    },
    body: formData,
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
