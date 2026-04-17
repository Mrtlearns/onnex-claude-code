// apps/api/src/routes/admin.ts
// Phase 11: Admin module — Authentik API proxy for user management + audit log read
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

const AUTHENTIK_URL =
  process.env.AUTHENTIK_INTERNAL_URL ?? 'http://authentik-server:9000'
const AUTHENTIK_TOKEN = process.env.AUTHENTIK_API_TOKEN ?? ''

// ---------------------------------------------------------------------------
// Authentik fetch helper — throws on non-ok
// ---------------------------------------------------------------------------
export async function authentikFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${AUTHENTIK_URL}${path}`
  const resp = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `Bearer ${AUTHENTIK_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Authentik ${resp.status}: ${body}`)
  }
  return resp
}

// ---------------------------------------------------------------------------
// Audit log INSERT helper — never throws (non-fatal side effect)
// ---------------------------------------------------------------------------
export async function insertAuditLog(
  pool: any,
  fastify: FastifyInstance,
  actor_id: string | null,
  actor_name: string | null,
  action: string,
  target_type: string | null,
  target_id: string | null,
  target_label: string | null,
  payload: Record<string, unknown> | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (actor_id, actor_name, action, target_type, target_id, target_label, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actor_id, actor_name, action, target_type, target_id, target_label, payload],
    )
  } catch (err) {
    fastify.log.warn({ err }, 'audit_log insert failed (non-fatal)')
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export async function adminRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/admin/users — list workspace users from Authentik
  // super_admin only
  fastify.get('/api/v1/admin/users', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['super_admin']),
    ],
    handler: async (_request: any, reply: any) => {
      const resp = await authentikFetch(
        '/api/v3/core/users/?page=1&page_size=100&ordering=username',
      )
      const data = await resp.json() as { results: any[] }

      const users = (data.results ?? []).map((u: any) => ({
        id: u.pk ?? u.id,
        name: u.name ?? ((`${u.first_name ?? ''}` + ' ' + `${u.last_name ?? ''}`).trim() || u.username),
        email: u.email,
        is_active: u.is_active,
        role: u.attributes?.aios_role ?? u.attributes?.role ?? null,
      }))

      return reply.code(200).send(users)
    },
  })

  // PATCH /api/v1/admin/users/:id/role — update user role via Authentik + audit
  // super_admin only
  fastify.patch('/api/v1/admin/users/:id/role', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const { id } = request.params as any
      const { role } = request.body as any
      const actor = request.user

      await authentikFetch(`/api/v3/core/users/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ attributes: { aios_role: role } }),
      })

      await insertAuditLog(
        pool,
        fastify,
        actor?.sub ?? null,
        actor?.name ?? actor?.preferred_username ?? null,
        'user_role_changed',
        'user',
        id,
        null,
        { new_role: role },
      )

      return reply.code(200).send({ updated: true })
    },
  })

  // POST /api/v1/admin/users/:id/suspend — deactivate user in Authentik + audit
  // super_admin only
  fastify.post('/api/v1/admin/users/:id/suspend', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const { id } = request.params as any
      const actor = request.user

      await authentikFetch(`/api/v3/core/users/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      })

      await insertAuditLog(
        pool,
        fastify,
        actor?.sub ?? null,
        actor?.name ?? actor?.preferred_username ?? null,
        'user_suspended',
        'user',
        id,
        null,
        null,
      )

      return reply.code(200).send({ suspended: true })
    },
  })

  // POST /api/v1/admin/invite — send invitation via Authentik + audit
  // super_admin only
  fastify.post('/api/v1/admin/invite', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const { email, role } = request.body as any
      const actor = request.user

      await authentikFetch('/api/v3/core/invitations/', {
        method: 'POST',
        body: JSON.stringify({
          name: email,
          expires: null,
          flow: null,
          single_use: true,
          fixed_data: { email, aios_role: role },
        }),
      })

      await insertAuditLog(
        pool,
        fastify,
        actor?.sub ?? null,
        actor?.name ?? actor?.preferred_username ?? null,
        'user_invited',
        'invitation',
        null,
        email,
        { email, role },
      )

      return reply.code(201).send({ invited: true })
    },
  })

  // GET /api/v1/admin/audit-log — read audit_log table (workspace-global, no tenant filter)
  // admin, super_admin
  fastify.get('/api/v1/admin/audit-log', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['admin', 'super_admin']),
    ],
    handler: async (_request: any, reply: any) => {
      const result = await pool.query(
        'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100',
      )
      return reply.code(200).send(result.rows)
    },
  })
}
