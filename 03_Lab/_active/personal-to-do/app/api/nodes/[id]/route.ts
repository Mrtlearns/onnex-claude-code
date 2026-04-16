import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { nodes, action_logs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'
import { computeStatus } from '@/lib/aging'
import { z } from 'zod'

const UpdateNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  type: z.enum(['note', 'task', 'idea', 'reference', 'person', 'project']).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  z: z.number().optional(),
  color: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  is_public: z.boolean().optional(),
  archived: z.boolean().optional(),
  due_date: z.string().datetime().nullable().optional(),
}).partial()

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, params.id))
    if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Update last_accessed_at
    await db
      .update(nodes)
      .set({ last_accessed_at: new Date() })
      .where(eq(nodes.id, params.id))

    return NextResponse.json({
      ...node,
      status: computeStatus(node.last_accessed_at),
    })
  } catch (err) {
    console.error(`GET /api/nodes/${params.id} error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = UpdateNodeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { due_date, ...restData } = parsed.data
    const [updated] = await db
      .update(nodes)
      .set({
        ...restData,
        ...(due_date !== undefined ? { due_date: due_date ? new Date(due_date) : null } : {}),
        updated_at: new Date(),
      })
      .where(eq(nodes.id, params.id))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'node.updated',
      entity_type: 'node',
      entity_id: params.id,
      payload: parsed.data as Record<string, unknown>,
    })

    return NextResponse.json({
      ...updated,
      status: computeStatus(updated.last_accessed_at),
    })
  } catch (err) {
    console.error(`PATCH /api/nodes/${params.id} error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [deleted] = await db
      .delete(nodes)
      .where(eq(nodes.id, params.id))
      .returning()

    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'node.deleted',
      entity_type: 'node',
      entity_id: params.id,
      payload: { title: deleted.title },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`DELETE /api/nodes/${params.id} error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
