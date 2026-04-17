// apps/api/src/routes/contacts.ts
// Contacts CRUD — nested under clients, tenant-scoped
import type { FastifyInstance } from 'fastify'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function contactsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/clients/:clientId/contacts — list contacts for a client
  fastify.get('/api/v1/clients/:clientId/contacts', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { clientId } = request.params as any

      // Verify client belongs to tenant
      const clientCheck = await pool.query(
        'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
        [clientId, tenantId],
      )
      if (clientCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      const result = await pool.query(
        'SELECT * FROM contacts WHERE client_id = $1 AND tenant_id = $2 ORDER BY name ASC',
        [clientId, tenantId],
      )

      return reply.code(200).send({ contacts: result.rows })
    },
  })

  // POST /api/v1/clients/:clientId/contacts — create contact
  fastify.post('/api/v1/clients/:clientId/contacts', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { clientId } = request.params as any
      const { name, email, phone, role } = request.body as any

      if (!name) {
        return reply.code(400).send({ error: 'name is required' })
      }

      // Verify client belongs to tenant
      const clientCheck = await pool.query(
        'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
        [clientId, tenantId],
      )
      if (clientCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Client not found' })
      }

      const result = await pool.query(
        `INSERT INTO contacts (tenant_id, client_id, name, email, phone, role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, clientId, name, email ?? null, phone ?? null, role ?? null],
      )

      return reply.code(201).send({ contact: result.rows[0] })
    },
  })

  // GET /api/v1/contacts/:id — get a single contact
  fastify.get('/api/v1/contacts/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' })
      }
      return reply.code(200).send({ contact: result.rows[0] })
    },
  })

  // PATCH /api/v1/contacts/:id — update contact
  fastify.patch('/api/v1/contacts/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const body = request.body as Record<string, unknown>

      const allowedFields = ['name', 'email', 'phone', 'role']
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
        `UPDATE contacts SET ${setClauses.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
        params,
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' })
      }

      return reply.code(200).send({ contact: result.rows[0] })
    },
  })

  // DELETE /api/v1/contacts/:id — delete contact
  fastify.delete('/api/v1/contacts/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'DELETE FROM contacts WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' })
      }

      return reply.code(204).send()
    },
  })
}
