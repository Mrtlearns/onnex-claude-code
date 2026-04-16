import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { node_attachments, action_logs } from '@/db/schema'
import { eq, asc, and, isNull } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'
import { uploadFile, getPublicFileUrl } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nodeId = req.nextUrl.searchParams.get('node_id')
  if (!nodeId) return NextResponse.json({ error: 'node_id required' }, { status: 400 })

  try {
    const attachments = await db
      .select()
      .from(node_attachments)
      .where(and(
        eq(node_attachments.node_id, nodeId),
        isNull(node_attachments.deleted_at),
      ))
      .orderBy(asc(node_attachments.created_at))

    const result = attachments.map((a) => ({
      ...a,
      public_url: a.storage_path ? getPublicFileUrl(a.storage_path) : null,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/attachments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  try {
    // Text / URL artifact — JSON body
    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { node_id, content, artifact_type: bodyType, filename } = body

      if (!node_id || !content?.trim()) {
        return NextResponse.json({ error: 'node_id and content are required' }, { status: 400 })
      }

      const artifactType = bodyType === 'url' ? 'url' : 'text'

      const id = nanoid()
      const [attachment] = await db
        .insert(node_attachments)
        .values({
          id,
          node_id,
          artifact_type: artifactType,
          content: content.trim(),
          filename: filename ?? null,
        })
        .returning()

      await db.insert(action_logs).values({
        id: nanoid(),
        action: 'artifact.created',
        entity_type: 'node_attachment',
        entity_id: id,
        payload: { node_id, artifact_type: artifactType },
      })

      return NextResponse.json({ ...attachment, public_url: null }, { status: 201 })
    }

    // File or image artifact — FormData
    const formData = await req.formData()
    const nodeId = formData.get('node_id') as string
    const file = formData.get('file') as File
    const artifactType = (formData.get('artifact_type') as string) ?? 'file'

    if (!nodeId || !file) {
      return NextResponse.json({ error: 'node_id and file are required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() ?? 'bin'
    const storagePath = `${nodeId}/${nanoid()}.${ext}`

    const { path, url } = await uploadFile(buffer, storagePath, file.type || 'application/octet-stream')

    const id = nanoid()
    const [attachment] = await db
      .insert(node_attachments)
      .values({
        id,
        node_id: nodeId,
        artifact_type: artifactType === 'image' ? 'image' : artifactType === 'voice' ? 'voice' : 'file',
        filename: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      })
      .returning()

    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'artifact.created',
      entity_type: 'node_attachment',
      entity_id: id,
      payload: { node_id: nodeId, filename: file.name, artifact_type: artifactType },
    })

    return NextResponse.json({ ...attachment, public_url: url }, { status: 201 })
  } catch (err) {
    console.error('POST /api/attachments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
