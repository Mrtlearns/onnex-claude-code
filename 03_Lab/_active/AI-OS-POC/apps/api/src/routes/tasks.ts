import type { FastifyInstance } from "fastify"
import { requireRole } from "../plugins/require-role.js"

const VALID_STATUSES = ["Backlog", "In Progress", "Review", "Done"]

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ""
}

export async function tasksRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  fastify.get("/api/v1/tasks", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { project_id, status, assignee_id } = request.query as any

      let query = "SELECT * FROM tasks WHERE tenant_id = $1"
      const params: unknown[] = [tenantId]
      let idx = 2

      if (project_id) { query += ` AND project_id = $${idx++}`; params.push(project_id) }
      if (status) { query += ` AND status = $${idx++}`; params.push(status) }
      if (assignee_id) {
        const resolvedId = assignee_id === "me" ? request.user.sub : assignee_id
        query += ` AND assignee_id = $${idx++}`
        params.push(resolvedId)
      }
      query += " ORDER BY created_at DESC"

      const result = await pool.query(query, params)
      return reply.code(200).send({ tasks: result.rows })
    },
  })

  fastify.post("/api/v1/tasks", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { title, description, project_id, assignee_id, status, due_date } = request.body as any
      const result = await pool.query(
        "INSERT INTO tasks (tenant_id, title, description, project_id, assignee_id, status, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [tenantId, title, description ?? null, project_id ?? null, assignee_id ?? null, status ?? "Backlog", due_date ?? null]
      )
      return reply.code(201).send({ task: result.rows[0] })
    },
  })

  fastify.get("/api/v1/tasks/:id", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const result = await pool.query(
        "SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2",
        [id, tenantId]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ task: result.rows[0] })
    },
  })

  fastify.patch("/api/v1/tasks/:id", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { title, description, status, assignee_id, due_date, project_id } = request.body as any

      if (status && !VALID_STATUSES.includes(status)) {
        return reply.code(400).send({ error: "invalid_status", allowed: VALID_STATUSES })
      }

      const result = await pool.query(
        "UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description), status = COALESCE($3, status), assignee_id = COALESCE($4, assignee_id), due_date = COALESCE($5, due_date), project_id = COALESCE($6, project_id) WHERE id = $7 AND tenant_id = $8 RETURNING *",
        [title, description, status, assignee_id, due_date, project_id, id, tenantId]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ task: result.rows[0] })
    },
  })

  fastify.post("/api/v1/tasks/:id/subtasks", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const { id } = request.params as any
      const { title } = request.body as any
      const result = await pool.query(
        "INSERT INTO subtasks (task_id, title) VALUES ($1, $2) RETURNING *",
        [id, title]
      )
      return reply.code(201).send({ subtask: result.rows[0] })
    },
  })

  fastify.patch("/api/v1/tasks/:id/subtasks/:sid", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const { sid } = request.params as any
      const { completed } = request.body as any
      const result = await pool.query(
        "UPDATE subtasks SET completed = $1 WHERE id = $2 RETURNING *",
        [completed, sid]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ subtask: result.rows[0] })
    },
  })

  fastify.post("/api/v1/tasks/:id/comments", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const { id } = request.params as any
      const authorId = (request as any).user?.sub
      const { body } = request.body as any
      const result = await pool.query(
        "INSERT INTO task_comments (task_id, author_id, body) VALUES ($1, $2, $3) RETURNING *",
        [id, authorId, body]
      )
      return reply.code(201).send({ comment: result.rows[0] })
    },
  })

  fastify.get("/api/v1/tasks/:id/comments", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const { id } = request.params as any
      const result = await pool.query(
        "SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC",
        [id]
      )
      return reply.code(200).send({ comments: result.rows })
    },
  })
}
