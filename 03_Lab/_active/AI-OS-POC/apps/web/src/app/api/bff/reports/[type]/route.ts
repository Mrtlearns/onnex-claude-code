// apps/web/src/app/api/bff/reports/[type]/route.ts
// BFF proxy: GET /api/bff/reports/[type] — proxies to aios-api and forwards CSV Content-Disposition

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

interface RouteParams {
  params: { type: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Forward all query params (period, start, end, format) to upstream
  const searchParams = request.nextUrl.searchParams.toString()
  const upstreamUrl = `${API}/api/v1/reports/${params.type}${searchParams ? `?${searchParams}` : ""}`

  const res = await fetch(upstreamUrl, {
    headers: { Authorization: `Bearer ${session.user.token}` },
    cache: "no-store",
  })

  if (!res.ok) {
    return NextResponse.json({ error: "upstream error" }, { status: res.status })
  }

  const contentType = res.headers.get("Content-Type") ?? "application/json"

  // If CSV response — pipe body as-is with Content-Disposition header forwarded
  if (contentType.includes("text/csv")) {
    const contentDisposition = res.headers.get("Content-Disposition") ?? ""
    return new Response(await res.arrayBuffer(), {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    })
  }

  // JSON response — forward as-is
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
