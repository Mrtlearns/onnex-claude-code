// apps/web/src/app/api/bff/settings/smtp/route.ts
// BFF proxy: GET + PATCH /api/v1/settings/smtp

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiGetSmtpConfig, apiUpdateSmtpConfig } from "@/lib/api-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const data = await apiGetSmtpConfig(session.user.token)
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  const data = await apiUpdateSmtpConfig(session.user.token, body)
  return NextResponse.json(data)
}
