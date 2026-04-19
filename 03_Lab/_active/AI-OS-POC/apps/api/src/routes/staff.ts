// apps/api/src/routes/staff.ts
// GET /api/v1/staff — people-picker list for assignment dropdowns
import type { FastifyInstance } from "fastify"

export async function staffRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  fastify.get("/api/v1/staff", {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = request.user?.tenant_id ?? "default"
      const result = await pool.query(
        `SELECT user_id, display_name, avatar_url, job_title, status, timezone
         FROM user_profiles
         WHERE tenant_id = $1 AND status != 'archived'
         ORDER BY display_name`,
        [tenantId],
      )
      return reply.code(200).send(result.rows)
    },
  })
}
