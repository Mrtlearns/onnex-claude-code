import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { nodes, action_logs } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'
import { computeStatus } from '@/lib/aging'
import { z } from 'zod'

const CreateNodeSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  type: z.enum(['note', 'task', 'idea', 'reference', 'person', 'project']).default('note'),
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
  color: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  is_public: z.boolean().default(false),
  due_date: z.string().datetime().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const archived = url.searchParams.get('archived') === 'true'

    const result = await db
      .select()
      .from(nodes)
      .where(and(eq(nodes.archived, archived)))

    // Lazy-update status based on last_accessed_at
    const withStatus = result.map((node) => ({
      ...node,
      status: computeStatus(node.last_accessed_at),
    }))

    return NextResponse.json(withStatus)
  } catch (err) {
    console.error('GET /api/nodes error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = CreateNodeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const id = nanoid()
    const now = new Date()
    const { due_date, ...restData } = parsed.data

    const [created] = await db
      .insert(nodes)
      .values({
        id,
        ...restData,
        due_date: due_date ? new Date(due_date) : null,
        status: 'fresh',
        created_at: now,
        updated_at: now,
        last_accessed_at: now,
      })
      .returning()

    // Log action
    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'node.created',
      entity_type: 'node',
      entity_id: id,
      payload: { title: created.title, type: created.type },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('POST /api/nodes error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
