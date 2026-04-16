import type { FastifyInstance } from "fastify"
import { requireRole } from "../plugins/require-role.js"

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ""
}

export async function contactsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  fastify.get("/api/v1/contacts", {
    preHandler: [(fastify as any).authenticate, requireRole(["admin", "manager", "team_member"])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { client_id } = request.query as any
      let query = "SELECT * FROM contacts WHERE tenant_id = $1"
      const params: unknown[] = [tenantId]
      if (client_id) { query += " AND client_id = $2"; params.push(client_id) }
      const result = await pool.query(query, params)
      return reply.code(200).send({ contacts: result.rows })
    },
  })
}
