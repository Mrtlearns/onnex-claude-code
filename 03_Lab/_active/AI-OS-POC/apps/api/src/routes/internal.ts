// apps/api/src/routes/internal.ts
// Internal-only endpoints — only reachable from within app_net (BFF → API)
import type { FastifyInstance } from "fastify"

export async function internalRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // POST /api/v1/internal/document-audit
  // Called fire-and-forget from BFF after Nextcloud file delete operations
  fastify.post("/api/v1/internal/document-audit", {
    handler: async (request: any, reply: any) => {
      try {
        const { action, path, actor } = (request.body ?? {}) as {
          action?: string
          path?: string
          actor?: string
        }
        if (!action || !path) {
          return reply.code(400).send({ error: "action and path required" })
        }
        await pool.query(
          "INSERT INTO document_audit_log (action, path, actor) VALUES ($1, $2, $3)",
          [action, path, actor ?? "bff"],
        )
        return reply.code(204).send()
      } catch (err: any) {
        return reply.code(500).send({ error: err.message })
      }
    },
  })
}
