import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { edges, action_logs } from '@/db/schema'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'
import { z } from 'zod'

const CreateEdgeSchema = z.object({
  source_id: z.string().min(1),
  target_id: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(['relates_to', 'depends_on', 'blocks', 'part_of', 'caused_by']).default('relates_to'),
  strength: z.number().min(0).max(1).default(1.0),
})

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await db.select().from(edges)
    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/edges error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = CreateEdgeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const id = nanoid()
    const [created] = await db
      .insert(edges)
      .values({ id, ...parsed.data })
      .returning()

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'edge.created',
      entity_type: 'edge',
      entity_id: id,
      payload: { source_id: created.source_id, target_id: created.target_id },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('POST /api/edges error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
