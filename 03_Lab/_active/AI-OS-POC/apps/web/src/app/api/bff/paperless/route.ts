// apps/web/src/app/api/bff/paperless/route.ts
// BFF proxy: GET document list from Paperless-ngx (credential isolation — token never sent to browser)

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const PAPERLESS_URL =
  process.env.PAPERLESS_INTERNAL_URL ?? process.env.PAPERLESS_BASE_URL ?? "http://paperless-web:8000"
const PAPERLESS_TOKEN = process.env.PAPERLESS_API_TOKEN ?? process.env.PAPERLESS_TOKEN

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const search = request.nextUrl.search
  const res = await fetch(
    `${PAPERLESS_URL}/api/documents/?page_size=50${search ? "&" + search.slice(1) : ""}`,
    {
      headers: {
        Authorization: `Token ${PAPERLESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  )

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
