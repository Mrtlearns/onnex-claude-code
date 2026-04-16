import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { node_attachments, action_logs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [attachment] = await db
      .select()
      .from(node_attachments)
      .where(eq(node_attachments.id, params.id))

    if (!attachment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (attachment.deleted_at) {
      return NextResponse.json({ error: 'Already in trash' }, { status: 409 })
    }

    // Soft delete — set deleted_at timestamp. File kept in storage until cron purge.
    await db
      .update(node_attachments)
      .set({ deleted_at: new Date() })
      .where(eq(node_attachments.id, params.id))

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'artifact.trashed',
      entity_type: 'node_attachment',
      entity_id: params.id,
      payload: { node_id: attachment.node_id, artifact_type: attachment.artifact_type },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/attachments/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
