// apps/api/src/routes/time-entries.ts
// Phase 9: Time Entries CRUD + weekly summary + T&M billable filter
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function timeEntriesRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/time-entries/weekly-summary — MUST be before /:id routes
  // Returns SUM(duration_minutes) grouped by date for 7 days from week_start
  // user_id=me resolves to JWT sub
  fastify.get('/api/v1/time-entries/weekly-summary', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { user_id, week_start } = request.query as Record<string, string>

      // Resolve user_id=me to JWT sub
      const resolvedUserId = user_id === 'me' ? request.user?.sub : user_id

      const result = await pool.query(
        `SELECT
           date::text AS date,
           SUM(duration_minutes) AS total_minutes,
           SUM(CASE WHEN billable THEN duration_minutes ELSE 0 END) AS billable_minutes
         FROM time_entries
         WHERE tenant_id = $1
           AND user_id = $2
           AND date >= $3::date
           AND date < ($3::date + INTERVAL '7 days')
         GROUP BY date
         ORDER BY date`,
        [tenantId, resolvedUserId, week_start],
      )

      return reply.code(200).send({ summary: result.rows })
    },
  })

  // GET /api/v1/time-entries — list with filters
  fastify.get('/api/v1/time-entries', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { project_id, date_from, date_to, billable, user_id } = request.query as Record<string, string>

      let query = 'SELECT * FROM time_entries WHERE tenant_id = $1'
      const params: unknown[] = [tenantId]
      let idx = 2

      if (project_id) {
        query += ` AND project_id = $${idx++}`
        params.push(project_id)
      }
      if (date_from) {
        query += ` AND date >= $${idx++}`
        params.push(date_from)
      }
      if (date_to) {
        query += ` AND date <= $${idx++}`
        params.push(date_to)
      }
      if (billable !== undefined) {
        query += ` AND billable = $${idx++}`
        params.push(billable === 'true')
      }
      if (user_id) {
        const resolvedUserId = user_id === 'me' ? request.user?.sub : user_id
        query += ` AND user_id = $${idx++}`
        params.push(resolvedUserId)
      }

      query += ' ORDER BY date DESC, created_at DESC'
      const result = await pool.query(query, params)
      return reply.code(200).send({ timeEntries: result.rows })
    },
  })

  // POST /api/v1/time-entries — create entry; user_id always from JWT sub
  fastify.post('/api/v1/time-entries', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub
      const { project_id, task_id, description, duration_minutes, date, billable = true, started_at, stopped_at } = request.body as any

      // Validate duration_minutes > 0
      if (!duration_minutes || Number(duration_minutes) <= 0) {
        return reply.code(400).send({ error: 'duration_minutes must be greater than 0' })
      }

      const result = await pool.query(
        `INSERT INTO time_entries
           (tenant_id, project_id, task_id, user_id, description, duration_minutes, date, billable, started_at, stopped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          tenantId,
          project_id,
          task_id ?? null,
          userId,
          description,
          duration_minutes,
          date,
          billable,
          started_at ?? null,
          stopped_at ?? null,
        ],
      )

      return reply.code(201).send({ timeEntry: result.rows[0] })
    },
  })

  // PATCH /api/v1/time-entries/:id — owner (user_id=JWT sub) OR manager/admin
  fastify.patch('/api/v1/time-entries/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const userId = request.user?.sub
      const role = request.user?.role ?? ''

      // Fetch entry to check ownership
      const fetchResult = await pool.query(
        'SELECT * FROM time_entries WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (fetchResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Time entry not found' })
      }

      const entry = fetchResult.rows[0]
      const isOwner = entry.user_id === userId
      const isManagerOrAdmin = ['manager', 'admin', 'super_admin'].includes(role)

      if (!isOwner && !isManagerOrAdmin) {
        return reply.code(403).send({ error: 'Cannot edit another user\'s time entry' })
      }

      const body = request.body as Record<string, unknown>
      const allowedFields = ['description', 'duration_minutes', 'date', 'billable', 'started_at', 'stopped_at', 'task_id']
      // NOTE: user_id is never patchable
      const setClauses: string[] = []
      const params: unknown[] = []
      let idx = 1

      for (const field of allowedFields) {
        if (field in body) {
          setClauses.push(`${field} = $${idx++}`)
          params.push(body[field])
        }
      }

      if (setClauses.length === 0) {
        return reply.code(400).send({ error: 'No valid fields to update' })
      }

      params.push(id, tenantId)
      const result = await pool.query(
        `UPDATE time_entries SET ${setClauses.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
        params,
      )

      return reply.code(200).send({ timeEntry: result.rows[0] })
    },
  })

  // DELETE /api/v1/time-entries/:id — owner OR manager/admin; hard delete
  fastify.delete('/api/v1/time-entries/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const userId = request.user?.sub
      const role = request.user?.role ?? ''

      // Fetch entry to check ownership
      const fetchResult = await pool.query(
        'SELECT * FROM time_entries WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (fetchResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Time entry not found' })
      }

      const entry = fetchResult.rows[0]
      const isOwner = entry.user_id === userId
      const isManagerOrAdmin = ['manager', 'admin', 'super_admin'].includes(role)

      if (!isOwner && !isManagerOrAdmin) {
        return reply.code(403).send({ error: 'Cannot delete another user\'s time entry' })
      }

      await pool.query('DELETE FROM time_entries WHERE id = $1 AND tenant_id = $2', [id, tenantId])

      return reply.code(204).send()
    },
  })
}
