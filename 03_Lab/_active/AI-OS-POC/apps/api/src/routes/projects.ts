// apps/api/src/routes/projects.ts
// Projects CRUD — tenant-scoped
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function projectsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/projects — list, optional ?client_id= / ?status=
  fastify.get('/api/v1/projects', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { client_id, status } = request.query as Record<string, string>

      let query = `SELECT p.*, c.name AS client_name
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         WHERE p.tenant_id = $1`
      const params: unknown[] = [tenantId]
      let idx = 2

      if (client_id) {
        query += ` AND p.client_id = $${idx++}`
        params.push(client_id)
      }
      if (status) {
        query += ` AND p.status = $${idx++}`
        params.push(status)
      }

      query += ' ORDER BY p.created_at DESC'

      const result = await pool.query(query, params)
      return reply.code(200).send({ projects: result.rows })
    },
  })

  // POST /api/v1/projects — create
  fastify.post('/api/v1/projects', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { client_id, name, description, status = 'Active', start_date, end_date, budget } = request.body as any

      if (!name) {
        return reply.code(400).send({ error: 'name is required' })
      }

      const result = await pool.query(
        `INSERT INTO projects (tenant_id, client_id, name, description, status, start_date, end_date, budget)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [tenantId, client_id ?? null, name, description ?? null, status, start_date ?? null, end_date ?? null, budget ?? null],
      )

      return reply.code(201).send({ project: result.rows[0] })
    },
  })

  // GET /api/v1/projects/:id — detail
  fastify.get('/api/v1/projects/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        `SELECT p.*, c.name AS client_name
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Project not found' })
      }
      return reply.code(200).send({ project: result.rows[0] })
    },
  })

  // PATCH /api/v1/projects/:id — update arbitrary fields
  fastify.patch('/api/v1/projects/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const body = request.body as Record<string, unknown>

      const allowedFields = ['name', 'description', 'status', 'start_date', 'end_date', 'budget', 'client_id', 'health', 'color', 'phases', 'plane_project_id', 'plane_workspace_slug', 'plane_project_name']
      const setClauses: string[] = []
      const params: unknown[] = []
      let idx = 1

      for (const field of allowedFields) {
        if (field in body) {
          setClauses.push(`${field} = $${idx++}`)
          // JSONB fields must be serialized
          params.push(field === 'phases' ? JSON.stringify(body[field]) : body[field])
        }
      }

      if (setClauses.length === 0) {
        return reply.code(400).send({ error: 'No valid fields to update' })
      }

      params.push(id, tenantId)
      const result = await pool.query(
        `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
        params,
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      return reply.code(200).send({ project: result.rows[0] })
    },
  })

  // PATCH /api/v1/projects/:id/archive — soft archive
  fastify.patch('/api/v1/projects/:id/archive', {
    preHandler: [(fastify as any).authenticate, requireRole(['manager', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        `UPDATE projects SET status = 'Archived' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      return reply.code(200).send({ project: result.rows[0] })
    },
  })

  // DELETE /api/v1/projects/:id — hard delete (admin/super_admin only)
  fastify.delete('/api/v1/projects/:id', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'DELETE FROM projects WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Project not found' })
      }

      return reply.code(204).send()
    },
  })

  // ─── Project Notes ─────────────────────────────────────────────────────────

  // GET /api/v1/projects/:id/notes
  fastify.get('/api/v1/projects/:id/notes', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const result = await pool.query(
        `SELECT id, project_id, content, author_id, author_name, created_at, updated_at
         FROM project_notes
         WHERE project_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC`,
        [id, tenantId],
      )
      return reply.code(200).send(result.rows)
    },
  })

  // POST /api/v1/projects/:id/notes
  fastify.post('/api/v1/projects/:id/notes', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { content, author_name } = request.body as any
      const authorId = (request as any).user?.sub ?? (request as any).user?.id ?? ''

      if (!content?.trim()) {
        return reply.code(400).send({ error: 'content is required' })
      }

      const result = await pool.query(
        `INSERT INTO project_notes (tenant_id, project_id, content, author_id, author_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, project_id, content, author_id, author_name, created_at, updated_at`,
        [tenantId, id, content.trim(), authorId, author_name ?? ''],
      )
      return reply.code(201).send(result.rows[0])
    },
  })

  // DELETE /api/v1/projects/:id/notes/:noteId
  fastify.delete('/api/v1/projects/:id/notes/:noteId', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { noteId } = request.params as any

      const result = await pool.query(
        `DELETE FROM project_notes WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [noteId, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Note not found' })
      }
      return reply.code(200).send({ deleted: true })
    },
  })

  // ─── Project Members ────────────────────────────────────────────────────────

  // GET /api/v1/projects/:id/members
  fastify.get('/api/v1/projects/:id/members', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const result = await pool.query(
        `SELECT pm.id, pm.project_id, pm.user_id, pm.user_name, pm.role, pm.added_at,
                COALESCE(SUM(te.duration_minutes), 0)::int AS logged_minutes,
                up.avatar_url
         FROM project_members pm
         LEFT JOIN time_entries te
           ON te.project_id = pm.project_id AND te.user_id = pm.user_id
         LEFT JOIN user_profiles up ON up.user_id = pm.user_id
         WHERE pm.project_id = $1 AND pm.tenant_id = $2
         GROUP BY pm.id, pm.project_id, pm.user_id, pm.user_name, pm.role, pm.added_at, up.avatar_url
         ORDER BY pm.added_at`,
        [id, tenantId],
      )
      return reply.code(200).send(result.rows)
    },
  })

  // POST /api/v1/projects/:id/members
  fastify.post('/api/v1/projects/:id/members', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { user_id, user_name, role } = request.body as any

      if (!user_id) {
        return reply.code(400).send({ error: 'user_id is required' })
      }

      const result = await pool.query(
        `INSERT INTO project_members (tenant_id, project_id, user_id, user_name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
         RETURNING id, project_id, user_id, user_name, role, added_at`,
        [tenantId, id, user_id, user_name ?? '', role ?? 'member'],
      )
      return reply.code(201).send(result.rows[0])
    },
  })

  // DELETE /api/v1/projects/:id/members/:userId
  fastify.delete('/api/v1/projects/:id/members/:userId', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id, userId } = request.params as any

      const result = await pool.query(
        `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3 RETURNING id`,
        [id, userId, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Member not found' })
      }
      return reply.code(200).send({ deleted: true })
    },
  })

  // PATCH /api/v1/projects/:id/members/:userId — update role
  fastify.patch('/api/v1/projects/:id/members/:userId', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id, userId } = request.params as any
      const { role } = request.body as any
      if (!role) return reply.code(400).send({ error: 'role required' })
      const result = await pool.query(
        `UPDATE project_members SET role = $1
         WHERE project_id = $2 AND user_id = $3 AND tenant_id = $4
         RETURNING id, project_id, user_id, user_name, role`,
        [role, id, userId, tenantId],
      )
      if (result.rowCount === 0) return reply.code(404).send({ error: 'Member not found' })
      return reply.send(result.rows[0])
    },
  })

  // ─── Project Activity ───────────────────────────────────────────────────────

  // GET /api/v1/projects/:id/activity — synthesized activity from project, tasks, members + audit_log
  fastify.get('/api/v1/projects/:id/activity', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const result = await pool.query(
        `SELECT id::text, actor_name, action, target_type, target_label, created_at FROM (

          -- Project created
          SELECT id::text, 'System' AS actor_name, 'project_created' AS action,
                 'project' AS target_type, name AS target_label, created_at
          FROM projects WHERE id = $1 AND tenant_id = $2

          UNION ALL

          -- Tasks created
          SELECT id::text, COALESCE((SELECT display_name FROM staff WHERE user_id = assignee_ids[1] LIMIT 1), 'System') AS actor_name,
                 'task_created' AS action, 'task' AS target_type, title AS target_label, created_at
          FROM tasks WHERE project_id = $1 AND tenant_id = $2

          UNION ALL

          -- Team members added
          SELECT id::text, user_name AS actor_name, 'member_added' AS action,
                 'member' AS target_type, user_name AS target_label, added_at AS created_at
          FROM project_members WHERE project_id = $1 AND tenant_id = $2

          UNION ALL

          -- Audit log entries (future mutations)
          SELECT id::text, actor_name, action, target_type, target_label, created_at
          FROM audit_log WHERE target_id = $1

        ) combined
        ORDER BY created_at DESC
        LIMIT 50`,
        [id, tenantId],
      )
      return reply.code(200).send(result.rows)
    },
  })
}
