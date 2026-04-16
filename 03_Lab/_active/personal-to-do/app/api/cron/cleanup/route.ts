import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { node_attachments, action_logs } from '@/db/schema'
import { and, isNotNull, lt } from 'drizzle-orm'
import { nanoid } from '@/lib/nanoid'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_MS)

    // Find all expired trash items
    const expired = await db
      .select()
      .from(node_attachments)
      .where(and(
        isNotNull(node_attachments.deleted_at),
        lt(node_attachments.deleted_at, cutoff),
      ))

    if (expired.length === 0) {
      return NextResponse.json({ purged: 0 })
    }

    // Delete files from Supabase storage
    const storagePaths = expired
      .filter((a) => a.storage_path && (a.artifact_type === 'file' || a.artifact_type === 'image'))
      .map((a) => a.storage_path!)

    if (storagePaths.length > 0) {
      const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(storagePaths)
      if (error) console.error('Cron storage delete error:', error)
    }

    // Hard-delete DB rows
    await db
      .delete(node_attachments)
      .where(and(
        isNotNull(node_attachments.deleted_at),
        lt(node_attachments.deleted_at, cutoff),
      ))

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'cron.cleanup',
      entity_type: 'node_attachment',
      entity_id: null,
      payload: { purged: expired.length, storage_files_removed: storagePaths.length },
    })

    return NextResponse.json({ purged: expired.length })
  } catch (err) {
    console.error('GET /api/cron/cleanup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
