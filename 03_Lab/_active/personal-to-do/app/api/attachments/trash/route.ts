import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { node_attachments } from '@/db/schema'
import { isNotNull, gt, desc } from 'drizzle-orm'
import { and } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { getPublicFileUrl } from '@/lib/supabase'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cutoff = new Date(Date.now() - RETENTION_MS)

    const trashed = await db
      .select()
      .from(node_attachments)
      .where(and(
        isNotNull(node_attachments.deleted_at),
        gt(node_attachments.deleted_at, cutoff),
      ))
      .orderBy(desc(node_attachments.deleted_at))

    const result = trashed.map((a) => ({
      ...a,
      public_url: a.storage_path ? getPublicFileUrl(a.storage_path) : null,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/attachments/trash error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
