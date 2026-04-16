import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { node_attachments, action_logs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'
import { getPublicFileUrl } from '@/lib/supabase'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function POST(
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

    if (!attachment.deleted_at) {
      return NextResponse.json({ error: 'Artifact is not in trash' }, { status: 409 })
    }

    if (Date.now() - new Date(attachment.deleted_at).getTime() > RETENTION_MS) {
      return NextResponse.json({ error: 'Retention period expired' }, { status: 410 })
    }

    const [restored] = await db
      .update(node_attachments)
      .set({ deleted_at: null })
      .where(eq(node_attachments.id, params.id))
      .returning()

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'artifact.restored',
      entity_type: 'node_attachment',
      entity_id: params.id,
      payload: { node_id: attachment.node_id, artifact_type: attachment.artifact_type },
    })

    return NextResponse.json({
      ...restored,
      public_url: restored.storage_path ? getPublicFileUrl(restored.storage_path) : null,
    })
  } catch (err) {
    console.error('POST /api/attachments/[id]/restore error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
