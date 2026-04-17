// apps/web/src/app/api/bff/paperless/[id]/route.ts
// BFF proxy: GET single document metadata from Paperless-ngx

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const PAPERLESS_URL =
  process.env.PAPERLESS_INTERNAL_URL ?? process.env.PAPERLESS_BASE_URL ?? "http://paperless-web:8000"
const PAPERLESS_TOKEN = process.env.PAPERLESS_API_TOKEN ?? process.env.PAPERLESS_TOKEN

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(`${PAPERLESS_URL}/api/documents/${params.id}/`, {
    headers: {
      Authorization: `Token ${PAPERLESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
