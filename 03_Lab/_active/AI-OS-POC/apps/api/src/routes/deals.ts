// apps/api/src/routes/deals.ts
// Phase 9: Deals CRUD + stage PATCH + convert-to-invoice POST
// Phase 12: n8n webhook trigger on deal_won
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'
import { fireN8nWebhook } from './settings.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function dealsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/deals — list, tenant-scoped, optional ?status= / ?pipeline=true
  fastify.get('/api/v1/deals', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { status, pipeline } = request.query as Record<string, string>

      let query = 'SELECT * FROM deals WHERE tenant_id = $1'
      const params: unknown[] = [tenantId]
      let idx = 2

      if (status) {
        query += ` AND status = $${idx++}`
        params.push(status)
      }

      if (pipeline === 'true') {
        query += ` AND status NOT IN ('won','lost')`
      }

      query += ' ORDER BY created_at DESC'

      const result = await pool.query(query, params)
      return reply.code(200).send({ deals: result.rows })
    },
  })

  // POST /api/v1/deals — create (all authenticated staff can create deals)
  fastify.post('/api/v1/deals', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { title, client_id, value = 0, probability = 0, expected_close, owner_id } = request.body as any

      const result = await pool.query(
        `INSERT INTO deals (tenant_id, client_id, title, value, probability, expected_close, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, client_id, title, value, probability, expected_close ?? null, owner_id ?? null],
      )
      return reply.code(201).send({ deal: result.rows[0] })
    },
  })

  // GET /api/v1/deals/:id — detail with client JOIN
  fastify.get('/api/v1/deals/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        `SELECT d.*, c.name AS client_name
         FROM deals d
         LEFT JOIN clients c ON c.id = d.client_id
         WHERE d.id = $1 AND d.tenant_id = $2`,
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Deal not found' })
      }
      return reply.code(200).send({ deal: result.rows[0] })
    },
  })

  // PATCH /api/v1/deals/:id — edit arbitrary fields
  fastify.patch('/api/v1/deals/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const body = request.body as Record<string, unknown>

      const allowedFields = ['title', 'value', 'probability', 'expected_close', 'owner_id', 'status', 'stage']
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
        `UPDATE deals SET ${setClauses.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
        params,
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Deal not found' })
      }
      return reply.code(200).send({ deal: result.rows[0] })
    },
  })

  // PATCH /api/v1/deals/:id/stage — move pipeline stage {status, stage}
  // NOTIF-02 trigger: inserts notification for deal owner when stage changes
  fastify.patch('/api/v1/deals/:id/stage', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { status, stage } = request.body as any

      // Fetch current deal before update to get title and owner for notification
      const existingResult = await pool.query(
        'SELECT * FROM deals WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (existingResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Deal not found' })
      }
      const existingDeal = existingResult.rows[0]

      const result = await pool.query(
        'UPDATE deals SET status = $1, stage = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *',
        [status, stage, id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Deal not found' })
      }

      // NOTIF-02: Notify deal owner when stage changes
      // owner_id is the column in deals table (set on create); fallback to owner_user_id or created_by if schema differs
      const ownerUserId = existingDeal.owner_id ?? existingDeal.owner_user_id ?? existingDeal.created_by
      if (ownerUserId) {
        try {
          await pool.query(
            `INSERT INTO notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
             VALUES ($1, $2, 'deal_stage_changed', 'Deal stage updated', $3, 'deal', $4)`,
            [tenantId, ownerUserId, `${existingDeal.title} moved to ${stage}`, existingDeal.id],
          )
        } catch {
          // Non-fatal — notification failure should not block stage update response
        }
      }

      // Audit: deal stage changed (non-fatal)
      try {
        await pool.query(
          `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, target_label, payload)
           VALUES ($1, $2, 'deal_stage_changed', 'deal', $3, $4, $5)`,
          [
            request.user?.sub ?? null,
            request.user?.name ?? request.user?.preferred_username ?? null,
            existingDeal.id,
            existingDeal.title,
            JSON.stringify({ old_stage: existingDeal.stage, new_stage: stage, old_status: existingDeal.status, new_status: status }),
          ],
        )
      } catch {
        // Non-fatal — audit log failure should not block stage update response
      }

      // Phase 12: n8n webhook trigger — deal_won
      if (status === 'won') {
        await fireN8nWebhook(pool, 'deal_won', {
          deal_id: existingDeal.id,
          tenant_id: tenantId,
        })
      }

      return reply.code(200).send({ deal: result.rows[0] })
    },
  })

  // POST /api/v1/deals/:id/convert — create draft invoice from won deal
  fastify.post('/api/v1/deals/:id/convert', {
    preHandler: [(fastify as any).authenticate, requireRole(['finance', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      // Fetch deal to get client_id
      const dealResult = await pool.query(
        'SELECT * FROM deals WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )

      if (dealResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Deal not found' })
      }

      const deal = dealResult.rows[0]

      // Create draft invoice from deal client_id and deal_id
      const invoiceResult = await pool.query(
        `INSERT INTO invoices (tenant_id, client_id, deal_id, status)
         VALUES ($1, $2, $3, 'draft') RETURNING *`,
        [tenantId, deal.client_id, deal.id],
      )

      // Audit: deal converted to invoice (non-fatal)
      try {
        await pool.query(
          `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, target_label, payload)
           VALUES ($1, $2, 'deal_converted_to_invoice', 'deal', $3, $4, $5)`,
          [
            request.user?.sub ?? null,
            request.user?.name ?? request.user?.preferred_username ?? null,
            deal.id,
            deal.title,
            JSON.stringify({ invoice_id: invoiceResult.rows[0].id }),
          ],
        )
      } catch {
        // Non-fatal — audit log failure should not block convert response
      }

      return reply.code(201).send({ invoice: invoiceResult.rows[0] })
    },
  })
}
