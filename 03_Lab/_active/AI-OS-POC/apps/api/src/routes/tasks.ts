// apps/api/src/routes/tasks.ts
// Phase 8: Tasks CRUD (original)
// Phase 10 modification: PATCH /tasks/:id inserts notification on assignee_id change (NOTIF-02)
// Phase 12: n8n webhook trigger on task_completed
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'
import { fireN8nWebhook } from './settings.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function tasksRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/tasks — list, tenant-scoped, optional ?project_id= / ?assignee_id= / ?status=
  fastify.get('/api/v1/tasks', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { project_id, assignee_id, status, parent_task_id } = request.query as Record<string, string>

      let query = 'SELECT * FROM tasks WHERE tenant_id = $1'
      const params: unknown[] = [tenantId]
      let idx = 2

      if (project_id) {
        query += ` AND project_id = $${idx++}`
        params.push(project_id)
      }
      if (assignee_id) {
        const resolvedId = assignee_id === 'me' ? request.user?.sub : assignee_id
        query += ` AND assignee_id = $${idx++}`
        params.push(resolvedId)
      }
      if (status) {
        query += ` AND status = $${idx++}`
        params.push(status)
      }
      if (parent_task_id === 'null') {
        query += ' AND parent_task_id IS NULL'
      } else if (parent_task_id) {
        query += ` AND parent_task_id = $${idx++}`
        params.push(parent_task_id)
      }

      const includeGantt = (request.query as any).view === 'gantt'

      // Build base query — add dependency data when gantt view requested
      let finalQuery = query + ' ORDER BY created_at DESC'
      const tasksResult = await pool.query(finalQuery, params)

      if (includeGantt) {
        const taskIds = tasksResult.rows.map((t: any) => t.id)
        let deps: any[] = []
        if (taskIds.length > 0) {
          const depsResult = await pool.query(
            `SELECT * FROM task_dependencies WHERE task_id = ANY($1) OR depends_on_task_id = ANY($1)`,
            [taskIds]
          )
          deps = depsResult.rows
        }
        return reply.code(200).send({ tasks: tasksResult.rows, dependencies: deps })
      }

      return reply.code(200).send({ tasks: tasksResult.rows })
    },
  })

  // POST /api/v1/tasks — create task
  fastify.post('/api/v1/tasks', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const {
        project_id, parent_task_id, assignee_id, title, description,
        status = 'todo', priority = 'medium', due_date,
      } = request.body as any
      const bodyRaw = request.body as any
      const assignee_ids: string[] = bodyRaw.assignee_ids ?? (assignee_id ? [assignee_id] : [])

      if (!title) {
        return reply.code(400).send({ error: 'title is required' })
      }

      const result = await pool.query(
        `INSERT INTO tasks
           (tenant_id, project_id, parent_task_id, assignee_id, assignee_ids, title, description, status, priority, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          tenantId,
          project_id ?? null,
          parent_task_id ?? null,
          assignee_id ?? null,
          assignee_ids,
          title,
          description ?? null,
          status,
          priority,
          due_date ?? null,
        ],
      )

      return reply.code(201).send({ task: result.rows[0] })
    },
  })

  // GET /api/v1/tasks/:id — task detail
  fastify.get('/api/v1/tasks/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }
      return reply.code(200).send({ task: result.rows[0] })
    },
  })

  // PATCH /api/v1/tasks/:id — update arbitrary fields
  // Phase 10 NOTIF-02: inserts notification for new assignee when assignee_id changes
  fastify.patch('/api/v1/tasks/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const body = request.body as Record<string, unknown>

      // Fetch current task BEFORE update to capture existing assignee_id
      const existingResult = await pool.query(
        'SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (existingResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }
      const existingTask = existingResult.rows[0]

      const allowedFields = [
        'project_id', 'parent_task_id', 'assignee_id', 'assignee_ids', 'title',
        'description', 'status', 'due_date',
        'start_date', 'end_date', 'estimated_hours', 'actual_hours',
        'task_type', 'ai_output', 'ai_completed_at', 'ai_session_id',
      ]
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
        `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
        params,
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }

      const updatedTask = result.rows[0]

      // NOTIF-02: Notify new assignee when assignee_id changes to a different user
      if (
        body.assignee_id &&
        body.assignee_id !== existingTask.assignee_id &&
        body.assignee_id !== null
      ) {
        try {
          await pool.query(
            `INSERT INTO notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
             VALUES ($1, $2, 'task_assigned', 'You were assigned a task', $3, 'task', $4)`,
            [tenantId, body.assignee_id, updatedTask.title, updatedTask.id],
          )
        } catch {
          // Non-fatal — notification failure should not block task update response
        }
      }

      // NOTIF-02b: Notify any NEW users added via assignee_ids array
      if (Array.isArray(body.assignee_ids)) {
        const existingIds: string[] = existingTask.assignee_ids ?? []
        const newIds = (body.assignee_ids as string[]).filter(id => !existingIds.includes(id))
        for (const userId of newIds) {
          try {
            await pool.query(
              `INSERT INTO notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
               VALUES ($1, $2, 'task_assigned', 'You were assigned a task', $3, 'task', $4)`,
              [tenantId, userId, updatedTask.title, updatedTask.id],
            )
          } catch {
            // Non-fatal
          }
        }
      }

      // Phase 12: n8n webhook trigger — task_completed
      if (updatedTask.status === 'Done') {
        await fireN8nWebhook(pool, 'task_completed', {
          task_id: updatedTask.id,
          tenant_id: tenantId,
        })
      }

      return reply.code(200).send({ task: updatedTask })
    },
  })

  // DELETE /api/v1/tasks/:id — hard delete (manager/admin/super_admin only)
  fastify.delete('/api/v1/tasks/:id', {
    preHandler: [(fastify as any).authenticate, requireRole(['manager', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'DELETE FROM tasks WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [id, tenantId],
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }

      return reply.code(204).send()
    },
  })

  // POST /api/v1/tasks/:id/comments — add comment to task
  fastify.post('/api/v1/tasks/:id/comments', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub
      const { id } = request.params as any
      const { body: commentBody } = request.body as any

      if (!commentBody) {
        return reply.code(400).send({ error: 'body is required' })
      }

      // Verify task exists and belongs to tenant
      const taskResult = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (taskResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }

      const result = await pool.query(
        `INSERT INTO task_comments (task_id, user_id, body)
         VALUES ($1, $2, $3) RETURNING *`,
        [id, userId, commentBody],
      )

      return reply.code(201).send({ comment: result.rows[0] })
    },
  })

  // GET /api/v1/tasks/:id/comments — list comments for a task
  fastify.get('/api/v1/tasks/:id/comments', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      // Verify task exists and belongs to tenant
      const taskResult = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (taskResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }

      const result = await pool.query(
        'SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC',
        [id],
      )

      return reply.code(200).send({ comments: result.rows })
    },
  })

  // POST /api/v1/tasks/:id/dependencies — add dependency
  fastify.post('/api/v1/tasks/:id/dependencies', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { depends_on_task_id, dependency_type = 'blocks' } = request.body as any

      if (!depends_on_task_id) {
        return reply.code(400).send({ error: 'depends_on_task_id is required' })
      }
      if (id === depends_on_task_id) {
        return reply.code(400).send({ error: 'A task cannot depend on itself' })
      }

      // Verify both tasks exist and belong to this tenant
      const check = await pool.query(
        'SELECT id FROM tasks WHERE id = ANY($1) AND tenant_id = $2',
        [[id, depends_on_task_id], tenantId]
      )
      if (check.rows.length < 2) {
        return reply.code(404).send({ error: 'One or both tasks not found' })
      }

      const result = await pool.query(
        `INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (task_id, depends_on_task_id) DO UPDATE SET dependency_type = EXCLUDED.dependency_type
         RETURNING *`,
        [id, depends_on_task_id, dependency_type]
      )

      return reply.code(201).send({ dependency: result.rows[0] })
    },
  })

  // DELETE /api/v1/tasks/:id/dependencies/:dep_id — remove dependency
  fastify.delete('/api/v1/tasks/:id/dependencies/:dep_id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id, dep_id } = request.params as any

      // Verify task belongs to tenant
      const taskCheck = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )
      if (taskCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }

      const result = await pool.query(
        'DELETE FROM task_dependencies WHERE id = $1 AND task_id = $2 RETURNING id',
        [dep_id, id]
      )
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Dependency not found' })
      }

      return reply.code(204).send()
    },
  })

  // GET /api/v1/tasks/:id/dependencies — list dependencies for a task
  fastify.get('/api/v1/tasks/:id/dependencies', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const taskCheck = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )
      if (taskCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Task not found' })
      }

      const result = await pool.query(
        `SELECT td.*, t.title as depends_on_title
         FROM task_dependencies td
         JOIN tasks t ON t.id = td.depends_on_task_id
         WHERE td.task_id = $1`,
        [id]
      )

      return reply.code(200).send({ dependencies: result.rows })
    },
  })

  // POST /api/v1/tasks/from-meeting — extract tasks from meeting minutes and optionally create them
  fastify.post('/api/v1/tasks/from-meeting', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { meeting_notes, project_id, assignee_id, create = false } = request.body as any

      if (!meeting_notes || typeof meeting_notes !== 'string' || meeting_notes.trim().length < 10) {
        return reply.code(400).send({ error: 'meeting_notes is required (min 10 chars)' })
      }

      // Fetch project context if project_id provided
      let projectContext = ''
      if (project_id) {
        try {
          const pRes = await pool.query(
            'SELECT name, status FROM projects WHERE id = $1 AND tenant_id = $2',
            [project_id, tenantId]
          )
          if (pRes.rows[0]) {
            projectContext = `Project: "${pRes.rows[0].name}" (${pRes.rows[0].status})\n`
          }
        } catch { /* non-fatal */ }
      }

      // Use OpenAI to extract tasks
      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" })

      const systemPrompt = `You are a project management assistant. Extract action items and tasks from meeting notes.
Return a JSON array of tasks. Each task must have:
- "title": string (concise, action-oriented, max 80 chars)
- "description": string (context from the meeting, 1-2 sentences, or null)
- "assignee_hint": string (person's name if mentioned, or null)
- "due_date": string (ISO date YYYY-MM-DD if a date is mentioned, or null)
- "task_type": one of "manual" | "code" | "content" | "research" | "business"
- "priority_hint": "high" | "medium" | "low"

Rules:
- Only extract concrete action items, not discussion points
- Keep titles short and action-oriented (e.g. "Review Q2 budget proposal" not "It was discussed that...")
- If someone is explicitly assigned ("John will do X"), set assignee_hint to their name
- task_type: "code" for dev tasks, "content" for writing/design, "research" for investigation, "business" for process/admin, "manual" for everything else
- Return ONLY the JSON array, no other text`

      let extractedTasks: Array<{
        title: string
        description: string | null
        assignee_hint: string | null
        due_date: string | null
        task_type: string
        priority_hint: string
      }> = []

      try {
        const completion = await openai.chat.completions.create({
          model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-pro-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${projectContext}Meeting notes:\n\n${meeting_notes}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        })

        const raw = completion.choices[0].message.content ?? '{}'
        const parsed = JSON.parse(raw)
        // Handle {"tasks": [...]}, {"items": [...]}, any key with array, or bare array
        if (Array.isArray(parsed)) {
          extractedTasks = parsed
        } else {
          const arrVal = Object.values(parsed).find(v => Array.isArray(v)) as any[]
          extractedTasks = arrVal ?? []
        }
      } catch (err: any) {
        return reply.code(502).send({ error: `AI extraction failed: ${err.message}` })
      }

      if (!create) {
        // Preview mode — return extracted tasks without creating
        return reply.code(200).send({
          extracted: extractedTasks,
          count: extractedTasks.length,
          project_id: project_id ?? null,
        })
      }

      // Create mode — insert tasks into DB
      const created = []
      for (const et of extractedTasks) {
        try {
          const r = await pool.query(
            `INSERT INTO tasks
               (tenant_id, project_id, assignee_id, title, description, status, due_date, task_type)
             VALUES ($1, $2, $3, $4, $5, 'Backlog', $6, $7) RETURNING *`,
            [
              tenantId,
              project_id ?? null,
              assignee_id ?? null,
              et.title,
              et.description ?? null,
              et.due_date ?? null,
              et.task_type ?? 'manual',
            ]
          )
          created.push(r.rows[0])
        } catch { /* skip failed inserts */ }
      }

      return reply.code(201).send({ created, count: created.length, project_id: project_id ?? null })
    },
  })
}
