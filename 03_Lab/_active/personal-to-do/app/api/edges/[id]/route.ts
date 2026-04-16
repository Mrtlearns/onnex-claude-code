import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { edges, action_logs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [deleted] = await db
      .delete(edges)
      .where(eq(edges.id, params.id))
      .returning()

    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'edge.deleted',
      entity_type: 'edge',
      entity_id: params.id,
      payload: {},
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`DELETE /api/edges/${params.id} error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
