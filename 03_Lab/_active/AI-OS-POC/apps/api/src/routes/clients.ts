import type { FastifyInstance } from "fastify"
import { requireRole } from "../plugins/require-role.js"

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ""
}

export async function clientsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  fastify.get("/api/v1/clients", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { q, status, archived } = request.query as any
      const showArchived = archived === "true"

      let query = "SELECT * FROM clients WHERE tenant_id = $1"
      const params: unknown[] = [tenantId]
      let idx = 2

      if (!showArchived) { query += " AND archived_at IS NULL" }
      if (status) { query += ` AND status = $${idx++}`; params.push(status) }
      if (q) { query += ` AND name ILIKE $${idx++}`; params.push(`%${q}%`) }
      query += " ORDER BY created_at DESC"

      const result = await pool.query(query, params)
      return reply.code(200).send({ clients: result.rows })
    },
  })

  fastify.post("/api/v1/clients", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { name, type, status, billing_address } = request.body as any
      const result = await pool.query(
        "INSERT INTO clients (tenant_id, name, type, status, billing_address) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [tenantId, name, type ?? "Direct", status ?? "Prospect", billing_address ?? null]
      )
      return reply.code(201).send({ client: result.rows[0] })
    },
  })

  fastify.get("/api/v1/clients/:id", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const clientResult = await pool.query(
        "SELECT * FROM clients WHERE id = $1 AND tenant_id = $2",
        [id, tenantId]
      )
      if (clientResult.rows.length === 0) {
        return reply.code(404).send({ error: "not_found" })
      }
      const contactsResult = await pool.query(
        "SELECT * FROM contacts WHERE client_id = $1",
        [id]
      )
      return reply.code(200).send({ client: { ...clientResult.rows[0], contacts: contactsResult.rows } })
    },
  })

  fastify.patch("/api/v1/clients/:id", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { name, type, status, billing_address } = request.body as any
      const result = await pool.query(
        "UPDATE clients SET name = COALESCE($1, name), type = COALESCE($2, type), status = COALESCE($3, status), billing_address = COALESCE($4, billing_address) WHERE id = $5 AND tenant_id = $6 RETURNING *",
        [name, type, status, billing_address, id, tenantId]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ client: result.rows[0] })
    },
  })

  fastify.patch("/api/v1/clients/:id/archive", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const result = await pool.query(
        "UPDATE clients SET archived_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING *",
        [id, tenantId]
      )
      if (result.rows.length === 0) { return reply.code(404).send({ error: "not_found" }) }
      return reply.code(200).send({ client: result.rows[0] })
    },
  })

  fastify.post("/api/v1/clients/:id/contacts", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { name, email, phone, role } = request.body as any
      const result = await pool.query(
        "INSERT INTO contacts (tenant_id, client_id, name, email, phone, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [tenantId, id, name, email ?? null, phone ?? null, role ?? null]
      )
      return reply.code(201).send({ contact: result.rows[0] })
    },
  })

  fastify.delete("/api/v1/clients/:id/contacts/:contactId", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager"])],
    handler: async (request: any, reply: any) => {
      const { contactId } = request.params as any
      await pool.query("DELETE FROM contacts WHERE id = $1", [contactId])
      return reply.code(200).send({ ok: true })
    },
  })
}
