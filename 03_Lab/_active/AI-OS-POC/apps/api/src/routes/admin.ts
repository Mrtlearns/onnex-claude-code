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

  // ---------------------------------------------------------------------------
  // Staff management (Authentik create + user_profiles row)
  // ---------------------------------------------------------------------------

  const ROLE_TO_GROUP: Record<string, string> = {
    super_admin: 'aios-super-admins',
    admin: 'aios-admins',
    manager: 'aios-managers',
    team_member: 'aios-team',
    contractor: 'aios-contractors',
    finance: 'aios-finance',
    client_viewer: 'aios-clients',
  }

  // POST /api/v1/admin/staff — create Authentik user with password + insert user_profiles
  fastify.post('/api/v1/admin/staff', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['admin', 'super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const { name, email, password, role, timezone, job_title, phone } = request.body as any
      const actor = request.user
      const tenantId = actor?.tenant_id ?? 'default'

      if (!name || !email || !password || !role) {
        return reply.code(400).send({ error: 'name, email, password, role are required' })
      }

      // 1. Create user in Authentik
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.')
      const createResp = await authentikFetch('/api/v3/core/users/', {
        method: 'POST',
        body: JSON.stringify({
          username,
          name,
          email,
          is_active: true,
          type: 'internal',
          groups: [],
          attributes: { aios_role: role },
        }),
      })
      const authentikUser = await createResp.json() as any
      const authentikPk = authentikUser.pk
      const userId: string = authentikUser.uid ?? String(authentikPk)

      // 2. Set password
      await authentikFetch(`/api/v3/core/users/${authentikPk}/set_password/`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      })

      // 3. Add to Authentik group
      const groupName = ROLE_TO_GROUP[role]
      if (groupName) {
        try {
          const groupResp = await authentikFetch(
            `/api/v3/core/groups/?name=${encodeURIComponent(groupName)}&page_size=1`,
          )
          const groupData = await groupResp.json() as any
          const groupPk = groupData.results?.[0]?.pk
          if (groupPk) {
            await authentikFetch(`/api/v3/core/groups/${groupPk}/add_user/`, {
              method: 'POST',
              body: JSON.stringify({ pk: authentikPk }),
            })
          }
        } catch (err) {
          fastify.log.warn({ err }, 'group assignment failed (non-fatal)')
        }
      }

      // 4. Insert user_profiles row
      await pool.query(
        `INSERT INTO user_profiles (user_id, tenant_id, display_name, timezone, job_title, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           timezone     = EXCLUDED.timezone,
           job_title    = EXCLUDED.job_title,
           phone        = EXCLUDED.phone,
           updated_at   = now()`,
        [userId, tenantId, name, timezone ?? null, job_title ?? null, phone ?? null],
      )

      // 5. Audit
      await insertAuditLog(pool, fastify, actor?.sub ?? null, actor?.name ?? null,
        'staff_created', 'user', userId, email, { role, name, email })

      return reply.code(201).send({ id: userId, name, email, role, authentik_pk: authentikPk })
    },
  })

  // PATCH /api/v1/admin/staff/:id — update profile fields (role via existing /users/:id/role)
  fastify.patch('/api/v1/admin/staff/:id', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['admin', 'super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const { id } = request.params as any
      const { timezone, job_title, phone, status, display_name, avatar_url } = request.body as any
      const actor = request.user
      const tenantId = actor?.tenant_id ?? 'default'

      const setClauses: string[] = []
      const values: unknown[] = []
      let i = 1
      if (display_name !== undefined) { setClauses.push(`display_name = $${i++}`); values.push(display_name) }
      if (timezone !== undefined)     { setClauses.push(`timezone = $${i++}`);     values.push(timezone) }
      if (job_title !== undefined)    { setClauses.push(`job_title = $${i++}`);    values.push(job_title) }
      if (phone !== undefined)        { setClauses.push(`phone = $${i++}`);        values.push(phone) }
      if (status !== undefined)       { setClauses.push(`status = $${i++}`);       values.push(status) }
      if (avatar_url !== undefined)   { setClauses.push(`avatar_url = $${i++}`);   values.push(avatar_url) }
      setClauses.push('updated_at = now()')

      if (setClauses.length > 1) {
        await pool.query(
          `UPDATE user_profiles SET ${setClauses.join(', ')} WHERE user_id = $${i} AND tenant_id = $${i + 1}`,
          [...values, id, tenantId],
        )
      }

      await insertAuditLog(pool, fastify, actor?.sub ?? null, actor?.name ?? null,
        'staff_updated', 'user', id, null, { timezone, job_title, phone, status })

      return reply.code(200).send({ updated: true })
    },
  })

  // POST /api/v1/admin/staff/:id/set-password — admin resets any user's Authentik password
  fastify.post('/api/v1/admin/staff/:id/set-password', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['admin', 'super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const { id } = request.params as any
      const { password } = request.body as { password: string }
      if (!password || password.length < 8) {
        return reply.code(400).send({ error: 'Password must be at least 8 characters' })
      }
      // Look up Authentik PK from UID stored in user_profiles
      const akResp = await authentikFetch(
        `/api/v3/core/users/?search=${encodeURIComponent(id)}&page_size=5`,
      )
      const akData = await akResp.json() as { results: any[] }
      const akUser = akData.results.find((u: any) => u.uid === id)
      if (!akUser) return reply.code(404).send({ error: 'Authentik user not found' })

      await authentikFetch(`/api/v3/core/users/${akUser.pk}/set_password/`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      })

      await insertAuditLog(pool, fastify, request.user?.sub ?? null, request.user?.name ?? null,
        'staff_password_reset', 'user', id, null, {})

      return reply.code(200).send({ ok: true })
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
