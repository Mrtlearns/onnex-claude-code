// apps/web/src/app/api/bff/brain/run/route.ts
// BFF POST — run a SOP: create job record → call AI → update job

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import type { Sop } from "@/types/api"

const AIOS_API = process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

async function apiCall(path: string, token: string, method: string, body?: unknown) {
  const res = await fetch(`${AIOS_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = session.user.token

  let body: { sop_slug?: string; input_context?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { sop_slug, input_context } = body

  if (!sop_slug) {
    return NextResponse.json({ error: "sop_slug is required" }, { status: 400 })
  }

  // Fetch SOP from DB
  const sopsRes = await apiCall("/api/v1/brain/sops", token, "GET")
  if (!sopsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch SOPs" }, { status: 502 })
  }
  const allSops: Sop[] = await sopsRes.json()
  const sop = allSops.find((s) => s.slug === sop_slug)
  if (!sop) {
    return NextResponse.json({ error: `SOP "${sop_slug}" not found` }, { status: 404 })
  }

  // 1. Create job record
  const createRes = await apiCall("/api/v1/brain/jobs", token, "POST", {
    sop_slug: sop.slug,
    sop_title: sop.title,
    input: input_context ? { context: input_context } : null,
  })

  if (!createRes.ok) {
    return NextResponse.json({ error: "Failed to create job record" }, { status: 502 })
  }

  const { id: jobId } = await createRes.json()

  // 2. Build the AI message — prepend system prompt to user message
  const userMessage = input_context?.trim()
    ? `${sop.system_prompt}\n\n---\n\nUser context: ${input_context}`
    : sop.system_prompt

  // 3. Call AI chat
  let aiOutput: string
  try {
    const aiRes = await apiCall("/api/v1/ai/chat", token, "POST", { query: userMessage })

    if (!aiRes.ok) {
      const errData = await aiRes.json().catch(() => ({}))
      throw new Error(errData?.error ?? `AI error ${aiRes.status}`)
    }

    const aiData = await aiRes.json()
    aiOutput = aiData?.response ?? ""
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "AI unavailable"

    // Update job as failed
    await apiCall(`/api/v1/brain/jobs/${jobId}`, token, "PATCH", {
      status: "failed",
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({ error: errorMessage }, { status: 502 })
  }

  // 4. Update job as completed
  await apiCall(`/api/v1/brain/jobs/${jobId}`, token, "PATCH", {
    status: "completed",
    output: aiOutput,
    completed_at: new Date().toISOString(),
  })

  return NextResponse.json({ job_id: jobId, output: aiOutput })
}
