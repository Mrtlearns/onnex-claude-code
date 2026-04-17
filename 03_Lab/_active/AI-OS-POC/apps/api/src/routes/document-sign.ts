// apps/api/src/routes/document-sign.ts
// E-signature via LibreSign (Nextcloud app).
// POST  /api/v1/documents/sign   — create signing request
// GET   /api/v1/documents/sign   — list signing requests (by entity or file_path)
// GET   /api/v1/documents/sign/:id — get single request

import type { FastifyInstance } from 'fastify'

const NC_URL = process.env.NEXTCLOUD_INTERNAL_URL ?? process.env.NEXTCLOUD_BASE_URL ?? 'http://nextcloud-app:80'
const NC_USER = process.env.NEXTCLOUD_USER ?? process.env.NEXTCLOUD_ADMIN_USER ?? 'ncadmin'
const NC_PASS = process.env.NEXTCLOUD_PASSWORD ?? process.env.NEXTCLOUD_ADMIN_PASSWORD ?? ''

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? 'default'
}

export async function documentSignRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // POST /api/v1/documents/sign
  // Body: { file_path, file_name?, signers: [{name, email, description?}], entity_type?, entity_id?, expires_in_days? }
  fastify.post('/api/v1/documents/sign', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const initiatedBy = request.user?.sub ?? 'unknown'

      const { file_path, file_name, signers, entity_type, entity_id, expires_in_days } =
        request.body as any

      if (!file_path || !Array.isArray(signers) || signers.length === 0) {
        return reply.code(400).send({ error: 'file_path and at least one signer are required' })
      }
      for (const s of signers) {
        if (!s.name || !s.email) {
          return reply.code(400).send({ error: 'Each signer must have name and email' })
        }
      }

      const fileName = file_name ?? file_path.split('/').pop() ?? 'document'
      const expiresAt = expires_in_days
        ? new Date(Date.now() + Number(expires_in_days) * 86_400_000).toISOString()
        : null

      // Call LibreSign OCS API
      const basicAuth = Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64')
      const lsBody = {
        file: { path: `/${file_path}` },
        name: fileName,
        users: signers.map((s: any) => ({
          displayName: s.name,
          email: s.email,
          description: s.description ?? 'Please review and sign this document.',
        })),
      }

      let libresignUuid: string | null = null
      try {
        const lsRes = await fetch(
          `${NC_URL}/ocs/v2.php/apps/libresign/api/v1/request-signature`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
              'OCS-APIREQUEST': 'true',
              Accept: 'application/json',
            },
            body: JSON.stringify(lsBody),
          },
        )

        const lsData = (await lsRes.json()) as any
        if (!lsRes.ok) {
          const msg =
            lsData?.ocs?.meta?.message ?? lsData?.message ?? `LibreSign HTTP ${lsRes.status}`
          return reply.code(502).send({ error: `LibreSign: ${msg}` })
        }

        libresignUuid =
          lsData?.ocs?.data?.uuid ?? lsData?.ocs?.data?.id?.toString() ?? null
      } catch (err) {
        const message = err instanceof Error ? err.message : 'LibreSign unavailable'
        fastify.log.error({ err }, 'LibreSign request failed')
        return reply.code(502).send({ error: message })
      }

      const result = await pool.query(
        `INSERT INTO document_signatures
           (tenant_id, file_path, file_name, entity_type, entity_id, signers,
            libresign_uuid, initiated_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          tenantId,
          file_path,
          fileName,
          entity_type ?? null,
          entity_id ?? null,
          JSON.stringify(signers),
          libresignUuid,
          initiatedBy,
          expiresAt,
        ],
      )

      return reply.code(201).send({ signature: result.rows[0] })
    },
  })

  // GET /api/v1/documents/sign/:id
  fastify.get('/api/v1/documents/sign/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'SELECT * FROM document_signatures WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (!result.rows.length) return reply.code(404).send({ error: 'Not found' })
      return reply.send({ signature: result.rows[0] })
    },
  })

  // GET /api/v1/documents/sign
  // Query params: entity_type, entity_id, file_path, status
  fastify.get('/api/v1/documents/sign', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { entity_type, entity_id, file_path, status } = request.query as Record<string, string>

      let q = 'SELECT * FROM document_signatures WHERE tenant_id = $1'
      const params: unknown[] = [tenantId]
      let idx = 2

      if (entity_type) { q += ` AND entity_type = $${idx++}`; params.push(entity_type) }
      if (entity_id)   { q += ` AND entity_id = $${idx++}`; params.push(entity_id) }
      if (file_path)   { q += ` AND file_path = $${idx++}`; params.push(file_path) }
      if (status)      { q += ` AND status = $${idx++}`; params.push(status) }
      q += ' ORDER BY initiated_at DESC LIMIT 200'

      const result = await pool.query(q, params)
      return reply.send({ signatures: result.rows })
    },
  })
}
