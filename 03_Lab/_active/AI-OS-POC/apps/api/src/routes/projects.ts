import type { FastifyInstance } from "fastify"
import { requireRole } from "../plugins/require-role.js"

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ""
}

export async function projectsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  fastify.get("/api/v1/projects", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { status, client_id, archived } = request.query as any
      const showArchived = archived === "true"

      let query = "SELECT * FROM projects WHERE tenant_id = $1"
      const params: unknown[] = [tenantId]
      let idx = 2

      if (!showArchived) { query += " AND archived_at IS NULL" }
      if (status) { query += ` AND status = $${idx++}`; params.push(status) }
      if (client_id) { query += ` AND client_id = $${idx++}`; params.push(client_id) }
      query += " ORDER BY created_at DESC"

      const result = await pool.query(query, params)
      return reply.code(200).send({ projects: result.rows })
    },
  })

  fastify.post("/api/v1/projects", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { name, client_id, status, start_date, end_date, budget, phases } = request.body as any
      const result = await pool.query(
        "INSERT INTO projects (tenant_id, name, client_id, status, start_date, end_date, budget, phases) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [tenantId, name, client_id ?? null, status ?? "Active", start_date ?? null, end_date ?? null, budget ?? null, JSON.stringify(phases ?? [])]
      )
      return reply.code(201).send({ project: result.rows[0] })
    },
  })

  fastify.get("/api/v1/projects/:id", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const result = await pool.query(
        "SELECT p.*, COUNT(t.id)::int AS task_count FROM projects p LEFT JOIN tasks t ON t.project_id = p.id WHERE p.id = $1 AND p.tenant_id = $2 GROUP BY p.id",
        [id, tenantId]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ project: result.rows[0] })
    },
  })

  fastify.patch("/api/v1/projects/:id", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { name, status, client_id, start_date, end_date, budget, phases } = request.body as any
      const result = await pool.query(
        "UPDATE projects SET name = COALESCE($1, name), status = COALESCE($2, status), client_id = COALESCE($3, client_id), start_date = COALESCE($4, start_date), end_date = COALESCE($5, end_date), budget = COALESCE($6, budget), phases = COALESCE($7, phases) WHERE id = $8 AND tenant_id = $9 RETURNING *",
        [name, status, client_id, start_date, end_date, budget, phases ? JSON.stringify(phases) : null, id, tenantId]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ project: result.rows[0] })
    },
  })

  fastify.patch("/api/v1/projects/:id/archive", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const result = await pool.query(
        "UPDATE projects SET archived_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING *",
        [id, tenantId]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ project: result.rows[0] })
    },
  })
}
