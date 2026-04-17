// apps/api/src/routes/documents.ts
// Phase 4 (original) + Phase 10 additions: document routes
import type { FastifyInstance } from 'fastify'
import { Connection, WorkflowClient } from '@temporalio/client'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PAPERLESS_URL = process.env.PAPERLESS_URL ?? 'http://paperless-web:8000'
const PAPERLESS_TOKEN = process.env.PAPERLESS_AI_API_TOKEN ?? ''

// Phase 4: Original document CRUD + Paperless/NextCloud integration
export async function documentRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  fastify.post('/api/v1/documents', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { filename, nextcloud_url } = request.body as any
    if (!filename || !nextcloud_url) {
      return reply.status(400).send({ error: 'filename and nextcloud_url are required' })
    }
    const tenantId = request.user?.sub ?? 'system'
    const result = await pool.query(
      'INSERT INTO documents (filename, nextcloud_url, tenant_id) VALUES ($1,$2,$3) RETURNING *',
      [filename, nextcloud_url, tenantId],
    )
    return reply.status(201).send(result.rows[0])
  })

  fastify.get('/api/v1/documents', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const tenantId = request.user?.sub ?? 'system'
    const result = await pool.query(
      'SELECT * FROM documents WHERE tenant_id=$1 ORDER BY created_at DESC',
      [tenantId],
    )
    return reply.send({ count: result.rowCount, results: result.rows })
  })

  fastify.get('/api/v1/documents/:id', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const tenantId = request.user?.sub ?? 'system'
    const result = await pool.query('SELECT * FROM documents WHERE id=$1 AND tenant_id=$2', [id, tenantId])
    if (!result.rows.length) return reply.status(404).send({ error: 'not found' })
    return reply.send(result.rows[0])
  })

  fastify.patch('/api/v1/documents/:id', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { paperless_tags, paperless_correspondent } = request.body as any
    const tenantId = request.user?.sub ?? 'system'
    const current = await pool.query('SELECT * FROM documents WHERE id=$1 AND tenant_id=$2', [id, tenantId])
    if (!current.rows.length) return reply.status(404).send({ error: 'not found' })
    const updated = await pool.query(
      `UPDATE documents SET
         paperless_tags = COALESCE($1, paperless_tags),
         paperless_correspondent = COALESCE($2, paperless_correspondent)
       WHERE id=$3 RETURNING *`,
      [paperless_tags ?? null, paperless_correspondent ?? null, id],
    )
    return reply.send(updated.rows[0])
  })
}

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? 'default'
}

// Temporal lazy singleton — connect on first use, close on shutdown
let temporalClient: WorkflowClient | null = null
async function getTemporalClient(): Promise<WorkflowClient> {
  if (!temporalClient) {
    const conn = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? 'temporal:7233',
    })
    temporalClient = new WorkflowClient({ connection: conn, namespace: 'aios' })
  }
  return temporalClient
}

export async function documentsPhase10Routes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // Register multipart plugin if available (optional dep)
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — @fastify/multipart is optional
    const multipart = await import('@fastify/multipart')
    await (fastify as any).register(multipart.default ?? multipart)
  } catch {
    // Not installed or already registered — continue without multipart
  }

  // POST /api/v1/documents/upload — multipart file upload
  // Saves to /tmp, triggers Temporal documentIngestionWorkflow, inserts activity_event
  // Returns 202 { workflowRunId }
  fastify.post('/api/v1/documents/upload', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub

      const data = await request.file()
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' })
      }

      const fileName = data.filename
      const filePath = join('/tmp', `${Date.now()}-${fileName}`)
      const buffer = await data.toBuffer()

      // Write buffer to temp file
      try {
        await writeFile(filePath, buffer)
      } catch {
        // In test environments /tmp write may fail — continue for workflow trigger
      }

      // Extract optional entity link from form fields
      const body = request.body as Record<string, any> || {}
      const entityType = body.entity_type?.value ?? body.entity_type
      const entityId = body.entity_id?.value ?? body.entity_id

      // Start Temporal documentIngestionWorkflow
      let workflowRunId = 'no-temporal-connection'
      try {
        const client = await getTemporalClient()
        const handle = await client.start('documentIngestionWorkflow', {
          args: [{ tenantId, filePath, fileName }],
          taskQueue: 'document-ingestion',
          workflowId: `doc-ingest-${Date.now()}`,
        })
        workflowRunId = handle.firstExecutionRunId
      } catch (err) {
        // Temporal unavailable — log but don't fail upload
        fastify.log?.warn({ err }, 'Temporal unavailable for documentIngestionWorkflow')
      }

      // Insert activity_event row
      try {
        await pool.query(
          `INSERT INTO activity_events (tenant_id, user_id, event_type, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'document_uploaded', $3, $4, $5)`,
          [tenantId, userId, entityType ?? 'document', entityId ?? null, JSON.stringify({ fileName, filePath })],
        )
      } catch {
        // Non-fatal — activity insert failure should not block upload response
      }

      // Notify watchers if upload is linked to an entity (NOTIF-02 trigger: document uploaded)
      if (entityType && entityId) {
        try {
          const watcherResult = await pool.query(
            `SELECT DISTINCT assignee_id FROM tasks
             WHERE tenant_id = $1 AND project_id = $2 AND assignee_id IS NOT NULL`,
            [tenantId, entityId],
          )
          for (const row of watcherResult.rows) {
            await pool.query(
              `INSERT INTO notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
               VALUES ($1, $2, 'document_uploaded', 'New document uploaded', $3, $4, $5)`,
              [tenantId, row.assignee_id, fileName, entityType, entityId],
            )
          }
        } catch {
          // Non-fatal — watcher notification failure should not block upload response
        }
      }

      return reply.code(202).send({ workflowRunId })
    },
  })

  // POST /api/v1/document-links — create a link between a document and an entity
  fastify.post('/api/v1/document-links', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { document_source, document_id, entity_type, entity_id, link_type = 'file', display_name } = request.body as any

      if (!document_source || !document_id || !entity_type || !entity_id) {
        return reply.code(400).send({ error: 'document_source, document_id, entity_type, and entity_id are required' })
      }

      const result = await pool.query(
        `INSERT INTO document_links (tenant_id, document_source, document_id, entity_type, entity_id, link_type, display_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, document_source, document_id, entity_type, entity_id, link_type, display_name ?? null],
      )

      return reply.code(201).send({ documentLink: result.rows[0] })
    },
  })

  // GET /api/v1/document-links — list links by entity
  fastify.get('/api/v1/document-links', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { entity_type, entity_id } = request.query as Record<string, string>

      let query = 'SELECT * FROM document_links WHERE tenant_id = $1'
      const params: unknown[] = [tenantId]
      let idx = 2

      if (entity_type) {
        query += ` AND entity_type = $${idx++}`
        params.push(entity_type)
      }
      if (entity_id) {
        query += ` AND entity_id = $${idx++}`
        params.push(entity_id)
      }

      query += ' ORDER BY created_at DESC'

      const result = await pool.query(query, params)
      return reply.code(200).send({ documentLinks: result.rows })
    },
  })

  // DELETE /api/v1/document-links/:id — remove a link
  fastify.delete('/api/v1/document-links/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'DELETE FROM document_links WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Document link not found' })
      }

      // Audit: document link removed (non-fatal)
      try {
        await pool.query(
          `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, target_label, payload)
           VALUES ($1, $2, 'document_link_removed', 'document_link', $3, $4, $5)`,
          [
            request.user?.sub ?? null,
            request.user?.name ?? request.user?.preferred_username ?? null,
            id,
            null,
            JSON.stringify({ tenant_id: tenantId }),
          ],
        )
      } catch {
        // Non-fatal — audit log failure should not block delete response
      }

      return reply.code(204).send()
    },
  })

  // GET /api/v1/document-comments — list comments for a document+entity
  fastify.get('/api/v1/document-comments', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { document_source, document_id, entity_type, entity_id } = request.query as Record<string, string>

      if (!document_source || !document_id || !entity_type || !entity_id) {
        return reply.code(400).send({ error: 'document_source, document_id, entity_type, and entity_id are required' })
      }

      const result = await pool.query(
        `SELECT * FROM document_comments
         WHERE tenant_id = $1 AND document_source = $2 AND document_id = $3
           AND entity_type = $4 AND entity_id = $5
         ORDER BY created_at ASC`,
        [tenantId, document_source, document_id, entity_type, entity_id],
      )
      return reply.code(200).send({ comments: result.rows })
    },
  })

  // POST /api/v1/document-comments — add a comment
  fastify.post('/api/v1/document-comments', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { document_source, document_id, entity_type, entity_id, content } = request.body as any

      if (!document_source || !document_id || !entity_type || !entity_id || !content) {
        return reply.code(400).send({ error: 'document_source, document_id, entity_type, entity_id, and content are required' })
      }

      const authorId = request.user?.sub ?? 'unknown'
      const authorName = request.user?.name ?? request.user?.preferred_username ?? ''

      const result = await pool.query(
        `INSERT INTO document_comments
           (tenant_id, document_source, document_id, entity_type, entity_id, author_id, author_name, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [tenantId, document_source, document_id, entity_type, entity_id, authorId, authorName, content],
      )
      return reply.code(201).send({ comment: result.rows[0] })
    },
  })

  // DELETE /api/v1/document-comments/:id — remove a comment
  fastify.delete('/api/v1/document-comments/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const authorId = request.user?.sub ?? 'unknown'

      const result = await pool.query(
        'DELETE FROM document_comments WHERE id = $1 AND tenant_id = $2 AND author_id = $3 RETURNING id',
        [id, tenantId, authorId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Comment not found or not yours' })
      }
      return reply.code(204).send()
    },
  })
}
