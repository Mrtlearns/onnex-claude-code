// apps/api/src/routes/notifications.ts
// Phase 10: Notifications CRUD + mark-read + mark-all-read
// IMPORTANT: read-all route MUST be registered BEFORE /:id route (Fastify route priority)
import type { FastifyInstance } from 'fastify'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? 'default'
}

export async function notificationsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/notifications — list for authenticated user, optional ?unread_only=true
  fastify.get('/api/v1/notifications', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub
      const { unread_only } = request.query as Record<string, string>

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      // Guard: if userId is missing or not a valid UUID, return empty list
      if (!userId || !UUID_RE.test(userId)) {
        return reply.code(200).send({ notifications: [] })
      }

      // NIL_UUID is the sentinel used by cron.ts for system-wide notifications
      // (overdue invoice alerts). Return both user-specific and system-broadcast rows.
      const NIL_UUID = '00000000-0000-0000-0000-000000000000'
      let query = 'SELECT * FROM notifications WHERE (user_id = $1 OR user_id = $2)'
      const params: unknown[] = [userId, NIL_UUID]

      if (unread_only === 'true') {
        query += ' AND read_at IS NULL'
      }

      query += ' ORDER BY created_at DESC'

      const result = await pool.query(query, params)
      return reply.code(200).send({ notifications: result.rows })
    },
  })

  // POST /api/v1/notifications — internal event insertion (no role gate)
  // Used by tasks.ts, deals.ts, documents.ts, and cron.ts to create notifications
  fastify.post('/api/v1/notifications', {
    handler: async (request: any, reply: any) => {
      const { tenant_id, user_id, type, title, body, entity_type, entity_id } = request.body as any

      if (!tenant_id || !user_id) {
        return reply.code(400).send({ error: 'tenant_id and user_id are required' })
      }

      const result = await pool.query(
        `INSERT INTO notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenant_id, user_id, type ?? null, title ?? null, body ?? null, entity_type ?? null, entity_id ?? null],
      )

      return reply.code(201).send({ notification: result.rows[0] })
    },
  })

  // PATCH /api/v1/notifications/read-all — mark ALL unread notifications for user as read
  // CRITICAL: Must be registered BEFORE /:id to prevent Fastify treating "read-all" as :id
  fastify.patch('/api/v1/notifications/read-all', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub

      const result = await pool.query(
        `UPDATE notifications
         SET read_at = NOW()
         WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
        [tenantId, userId],
      )

      return reply.code(200).send({ updated: result.rowCount ?? 0 })
    },
  })

  // PATCH /api/v1/notifications/:id/read — mark single notification as read
  fastify.patch('/api/v1/notifications/:id/read', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub
      const { id } = request.params as any

      const result = await pool.query(
        `UPDATE notifications
         SET read_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND user_id = $3
         RETURNING *`,
        [id, tenantId, userId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Notification not found' })
      }

      return reply.code(200).send({ notification: result.rows[0] })
    },
  })

  // DELETE /api/v1/notifications/:id — remove notification
  fastify.delete('/api/v1/notifications/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub
      const { id } = request.params as any

      const result = await pool.query(
        'DELETE FROM notifications WHERE id = $1 AND tenant_id = $2 AND user_id = $3 RETURNING id',
        [id, tenantId, userId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Notification not found' })
      }

      return reply.code(204).send()
    },
  })
}
