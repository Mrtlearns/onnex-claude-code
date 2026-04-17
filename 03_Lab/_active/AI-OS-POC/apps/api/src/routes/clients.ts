// apps/api/src/routes/clients.ts
// Clients CRUD + archive — tenant-scoped
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function clientsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/clients — list, optional ?status= / ?type=
  fastify.get('/api/v1/clients', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { status, type } = request.query as Record<string, string>

      let query = 'SELECT * FROM clients WHERE tenant_id = $1'
      const params: unknown[] = [tenantId]
      let idx = 2

      if (status) {
        query += ` AND status = $${idx++}`
        params.push(status)
      }
      if (type) {
        query += ` AND type = $${idx++}`
        params.push(type)
      }

      query += ' ORDER BY name ASC'

      const result = await pool.query(query, params)
      return reply.code(200).send({ clients: result.rows })
    },
  })

  // POST /api/v1/clients — create
  fastify.post('/api/v1/clients', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { name, type, status = 'Active', billing_address, website, notes } = request.body as any

      if (!name) {
        return reply.code(400).send({ error: 'name is required' })
      }

      const result = await pool.query(
        `INSERT INTO clients (tenant_id, name, type, status, billing_address, website, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, name, type ?? null, status, billing_address ?? null, website ?? null, notes ?? null],
      )

      return reply.code(201).send({ client: result.rows[0] })
    },
  })

  // GET /api/v1/clients/:id — detail
  fastify.get('/api/v1/clients/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'SELECT * FROM clients WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Client not found' })
      }
      return reply.code(200).send({ client: result.rows[0] })
    },
  })

  // PATCH /api/v1/clients/:id — update arbitrary fields
  fastify.patch('/api/v1/clients/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const body = request.body as Record<string, unknown>

      const allowedFields = ['name', 'type', 'status', 'billing_address', 'website', 'notes']
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
        `UPDATE clients SET ${setClauses.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
        params,
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      return reply.code(200).send({ client: result.rows[0] })
    },
  })

  // PATCH /api/v1/clients/:id/archive — soft archive
  fastify.patch('/api/v1/clients/:id/archive', {
    preHandler: [(fastify as any).authenticate, requireRole(['manager', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        `UPDATE clients SET status = 'Archived' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      return reply.code(200).send({ client: result.rows[0] })
    },
  })

  // DELETE /api/v1/clients/:id — hard delete (admin/super_admin only)
  fastify.delete('/api/v1/clients/:id', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'DELETE FROM clients WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      return reply.code(204).send()
    },
  })
}
