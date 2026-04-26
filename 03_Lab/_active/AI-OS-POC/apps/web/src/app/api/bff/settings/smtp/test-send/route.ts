// apps/web/src/app/api/bff/settings/smtp/test-send/route.ts
// BFF proxy: POST /api/v1/settings/smtp/test-send

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { apiTestSmtpSend } from "@/lib/api-client"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  try {
    const data = await apiTestSmtpSend(session.user.token, body.to)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "SMTP test failed"
    return NextResponse.json({ success: false, error: msg })
  }
}
