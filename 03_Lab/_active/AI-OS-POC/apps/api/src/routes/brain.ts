// apps/api/src/routes/brain.ts
// AI Brain — SOP job runs CRUD
import type { FastifyInstance } from 'fastify'

export async function brainRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  function getTenantId(request: any): string {
    return request.user?.tenantId ?? request.user?.tenant_id ?? 'default'
  }

  // GET /api/v1/brain/jobs — last 50 job runs for tenant
  fastify.get('/api/v1/brain/jobs', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const result = await pool.query(
        `SELECT id, sop_slug, sop_title, status, input, output, error, started_at, completed_at
         FROM brain_job_runs
         WHERE tenant_id = $1
         ORDER BY started_at DESC
         LIMIT 50`,
        [tenantId],
      )
      return reply.code(200).send(result.rows)
    },
  })

  // POST /api/v1/brain/jobs — insert running record
  fastify.post('/api/v1/brain/jobs', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { sop_slug, sop_title, input } = request.body as any

      if (!sop_slug || !sop_title) {
        return reply.code(400).send({ error: 'sop_slug and sop_title are required' })
      }

      const result = await pool.query(
        `INSERT INTO brain_job_runs (tenant_id, sop_slug, sop_title, status, input)
         VALUES ($1, $2, $3, 'running', $4)
         RETURNING id`,
        [tenantId, sop_slug, sop_title, input ? JSON.stringify(input) : null],
      )
      return reply.code(201).send({ id: result.rows[0].id })
    },
  })

  // PATCH /api/v1/brain/jobs/:id — update status/output/error
  fastify.patch('/api/v1/brain/jobs/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as { id: string }
      const { status, output, error, completed_at } = request.body as any

      if (!status) {
        return reply.code(400).send({ error: 'status is required' })
      }

      const result = await pool.query(
        `UPDATE brain_job_runs
         SET status = $1,
             output = COALESCE($2, output),
             error  = COALESCE($3, error),
             completed_at = COALESCE($4::timestamptz, completed_at)
         WHERE id = $5 AND tenant_id = $6
         RETURNING id, status`,
        [status, output ?? null, error ?? null, completed_at ?? null, id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Job run not found' })
      }
      return reply.code(200).send(result.rows[0])
    },
  })

  // ─── SOP CRUD ──────────────────────────────────────────────────────────────

  // GET /api/v1/brain/sops — all SOPs for tenant
  fastify.get('/api/v1/brain/sops', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const result = await pool.query(
        `SELECT id, tenant_id, slug, title, description, category, auto,
                input_label, system_prompt, created_at, updated_at
         FROM sops
         WHERE tenant_id = $1
         ORDER BY created_at ASC`,
        [tenantId],
      )
      return reply.code(200).send(result.rows)
    },
  })

  // POST /api/v1/brain/sops — create SOP
  fastify.post('/api/v1/brain/sops', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { slug, title, description, category, auto, input_label, system_prompt } = request.body as any

      if (!slug || !title || !system_prompt) {
        return reply.code(400).send({ error: 'slug, title, and system_prompt are required' })
      }

      const result = await pool.query(
        `INSERT INTO sops (tenant_id, slug, title, description, category, auto, input_label, system_prompt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, tenant_id, slug, title, description, category, auto, input_label, system_prompt, created_at, updated_at`,
        [tenantId, slug, title, description ?? '', category ?? 'operations', auto ?? false, input_label ?? null, system_prompt],
      )
      return reply.code(201).send(result.rows[0])
    },
  })

  // PATCH /api/v1/brain/sops/:id — update SOP
  fastify.patch('/api/v1/brain/sops/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as { id: string }
      const { slug, title, description, category, auto, input_label, system_prompt } = request.body as any

      const result = await pool.query(
        `UPDATE sops
         SET slug         = COALESCE($1, slug),
             title        = COALESCE($2, title),
             description  = COALESCE($3, description),
             category     = COALESCE($4, category),
             auto         = COALESCE($5, auto),
             input_label  = $6,
             system_prompt = COALESCE($7, system_prompt),
             updated_at   = now()
         WHERE id = $8 AND tenant_id = $9
         RETURNING id, tenant_id, slug, title, description, category, auto, input_label, system_prompt, created_at, updated_at`,
        [slug ?? null, title ?? null, description ?? null, category ?? null, auto ?? null, input_label ?? null, system_prompt ?? null, id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'SOP not found' })
      }
      return reply.code(200).send(result.rows[0])
    },
  })

  // DELETE /api/v1/brain/sops/:id — delete SOP
  fastify.delete('/api/v1/brain/sops/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as { id: string }

      const result = await pool.query(
        `DELETE FROM sops WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'SOP not found' })
      }
      return reply.code(200).send({ deleted: true })
    },
  })
}
