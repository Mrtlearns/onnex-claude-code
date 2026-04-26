// apps/web/src/app/api/bff/settings/n8n/test/route.ts
// Server-side connectivity test for the configured n8n webhook URL

import { auth } from "@/auth"
import { NextResponse } from "next/server"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function POST() {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settingsRes = await fetch(`${AIOS_API}/api/v1/settings/n8n`, {
    headers: { Authorization: `Bearer ${session.user.token}` },
  }).catch(() => null)

  if (!settingsRes?.ok) {
    return NextResponse.json({ ok: false, error: "Could not read n8n settings" })
  }

  const settings = await settingsRes.json()
  if (!settings.webhook_url) {
    return NextResponse.json({ ok: false, error: "No webhook URL configured" })
  }

  try {
    const res = await fetch(settings.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "deal_won", test: true, source: "aios-settings-test" }),
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json({ ok: res.ok || res.status < 500, status: res.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Connection failed"
    return NextResponse.json({ ok: false, error: msg })
  }
}
