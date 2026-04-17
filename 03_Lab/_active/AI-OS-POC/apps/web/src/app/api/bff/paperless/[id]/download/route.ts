// apps/web/src/app/api/bff/paperless/[id]/download/route.ts
// BFF proxy: Stream PDF from Paperless-ngx — iframe src points to this route
// Credentials (PAPERLESS_API_TOKEN) stay server-side; browser sees only the streamed PDF bytes

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
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const res = await fetch(
    `${PAPERLESS_URL}/api/documents/${params.id}/download/`,
    {
      headers: {
        Authorization: `Token ${PAPERLESS_TOKEN}`,
      },
    },
  )

  if (!res.ok) {
    return new NextResponse("Document not found", { status: res.status })
  }

  // Stream the response body with correct headers so <iframe src={...}> renders the PDF
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type":
        res.headers.get("Content-Type") ?? "application/pdf",
      "Content-Disposition": "inline",
    },
  })
}
