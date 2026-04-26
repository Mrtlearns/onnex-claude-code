import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'

const FEEDBACK_TYPES = ['Bug Report', 'UI/UX Issue', 'Feature Request', 'Performance Issue', 'Data/Accuracy Issue', 'Other'] as const
const PRIORITY_LEVELS = ['Critical', 'High', 'Medium', 'Low'] as const

const schema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  priority: z.enum(PRIORITY_LEVELS),
  description: z.string().min(10).max(5000),
  page_url: z.string(),
  user_email: z.string(),
  user_name: z.string().max(200),
  screenshot_b64: z.string().startsWith('data:image/').optional(),
})

const N8N_FEEDBACK_WEBHOOK_URL = process.env.N8N_FEEDBACK_WEBHOOK_URL ?? 'http://n8n:5678/webhook/aios-feedback'
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET ?? ''

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const res = await fetch(N8N_FEEDBACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_WEBHOOK_SECRET ? { 'X-N8N-Token': N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error('[feedback] n8n returned', res.status)
      return NextResponse.json({ error: 'Webhook error' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[feedback] n8n unreachable', err)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
