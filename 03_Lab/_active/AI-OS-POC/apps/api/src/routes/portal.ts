// apps/api/src/routes/portal.ts
// Phase 12 plan 03: Client Portal API — read-only, client-scoped
// All routes gated to client_viewer role
import type { FastifyInstance } from 'fastify'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? 'default'
}

// ---------------------------------------------------------------------------
// Helper: resolve client_id for a portal user
// ---------------------------------------------------------------------------
async function getPortalClientId(
  pool: any,
  userId: string,
  tenantId: string,
): Promise<string | null> {
  const row = await pool.query(
    'SELECT client_id FROM portal_client_users WHERE user_id = $1 AND tenant_id = $2',
    [userId, tenantId],
  )
  return row.rows[0]?.client_id ?? null
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export async function portalRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/portal/me — return the client linked to the authenticated portal user
  // Note: authorization is enforced by portal_client_users lookup, not role claim
  // (Authentik access token may not carry groups claim)
  fastify.get('/api/v1/portal/me', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const userId = request.user?.sub
      const tenantId = getTenantId(request)

      const clientId = await getPortalClientId(pool, userId, tenantId)
      if (!clientId) {
        return reply.status(404).send({ error: 'No portal mapping found' })
      }

      const result = await pool.query(
        'SELECT id, name FROM clients WHERE id = $1',
        [clientId],
      )
      const client = result.rows[0]
      if (!client) {
        return reply.status(404).send({ error: 'Client not found' })
      }

      return reply.code(200).send({
        client_id: client.id,
        client_name: client.name,
      })
    },
  })

  // GET /api/v1/portal/projects — active projects for the mapped client with task counts
  fastify.get('/api/v1/portal/projects', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const userId = request.user?.sub
      const tenantId = getTenantId(request)

      const clientId = await getPortalClientId(pool, userId, tenantId)
      if (!clientId) {
        return reply.status(403).send({ error: 'No portal access' })
      }

      const result = await pool.query(
        `SELECT
           p.id, p.name, p.status, p.start_date, p.end_date, p.budget,
           COUNT(t.id)::int                                                  AS tasks_total,
           COUNT(t.id) FILTER (WHERE t.status IN ('done', 'Done', 'complete', 'completed'))::int AS tasks_done
         FROM projects p
         LEFT JOIN tasks t ON t.project_id = p.id
         WHERE p.client_id = $1
           AND p.status = 'Active'
         GROUP BY p.id
         ORDER BY p.start_date DESC`,
        [clientId],
      )

      return reply.code(200).send({ projects: result.rows })
    },
  })

  // GET /api/v1/portal/invoices — invoices for the mapped client with PDF download URL
  fastify.get('/api/v1/portal/invoices', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const userId = request.user?.sub
      const tenantId = getTenantId(request)

      const clientId = await getPortalClientId(pool, userId, tenantId)
      if (!clientId) {
        return reply.status(403).send({ error: 'No portal access' })
      }

      const result = await pool.query(
        `SELECT id, status, due_date, sent_at, paid_at, notes
         FROM invoices
         WHERE client_id = $1
         ORDER BY due_date DESC`,
        [clientId],
      )

      const invoices = result.rows.map((row: any) => ({
        ...row,
        pdf_download_url: `/api/v1/invoices/${row.id}/pdf`,
      }))

      return reply.code(200).send({ invoices })
    },
  })

  // GET /api/v1/portal/documents — document_links scoped to the client's projects
  fastify.get('/api/v1/portal/documents', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const userId = request.user?.sub
      const tenantId = getTenantId(request)

      const clientId = await getPortalClientId(pool, userId, tenantId)
      if (!clientId) {
        return reply.status(403).send({ error: 'No portal access' })
      }

      // Get project ids for this client
      const projectsResult = await pool.query(
        'SELECT id FROM projects WHERE client_id = $1',
        [clientId],
      )
      const projectIds: string[] = projectsResult.rows.map((r: any) => r.id)

      if (projectIds.length === 0) {
        return reply.code(200).send({ documents: [] })
      }

      // Get document_links scoped to those projects
      const docsResult = await pool.query(
        `SELECT dl.id, dl.document_source, dl.document_id, dl.entity_type, dl.entity_id, dl.created_at
         FROM document_links dl
         WHERE dl.entity_type = 'project'
           AND dl.entity_id = ANY($1)
         ORDER BY dl.created_at DESC`,
        [projectIds],
      )

      return reply.code(200).send({ documents: docsResult.rows })
    },
  })


// Temporary debug endpoint — remove after testing
fastify.get('/api/v1/debug/whoami', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
        return reply.code(200).send({
            sub: request.user?.sub,
            tenantId: request.user?.tenantId,
            tenant_id: request.user?.tenant_id,
            groups: request.user?.groups,
            all_keys: Object.keys(request.user ?? {}),
            user: request.user,
        })
    }
})
}