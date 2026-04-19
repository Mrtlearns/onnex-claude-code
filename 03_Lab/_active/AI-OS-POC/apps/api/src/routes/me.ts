import type { FastifyInstance } from "fastify"

export default async function meRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/me — JWT claims summary
  fastify.get("/api/v1/me", {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    return reply.code(200).send({
      sub: user.sub,
      email: user.email ?? null,
      name: user.name ?? null,
      groups: user.groups ?? [],
      tenant_id: user.tenant_id ?? null,
    })
  })

  // GET /api/v1/me/profile — full profile row (auto-created if missing)
  fastify.get("/api/v1/me/profile", {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const userId: string = user.sub
    const tenantId: string = user.tenant_id ?? "default"
    const displayName: string = user.name ?? user.email ?? userId

    // Upsert on read so every authenticated user gets a profile row
    const result = await pool.query(
      `INSERT INTO user_profiles (user_id, tenant_id, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = user_profiles.updated_at
       RETURNING *`,
      [userId, tenantId, displayName],
    )
    return reply.code(200).send(result.rows[0])
  })

  // PATCH /api/v1/me/profile — self-service update
  fastify.patch("/api/v1/me/profile", {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const userId: string = user.sub
    const tenantId: string = user.tenant_id ?? "default"
    const { display_name, timezone, job_title, phone, avatar_url } = (request as any).body ?? {}

    await pool.query(
      `INSERT INTO user_profiles (user_id, tenant_id, display_name, timezone, job_title, phone, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name  = COALESCE(NULLIF(EXCLUDED.display_name, ''), user_profiles.display_name),
         timezone      = EXCLUDED.timezone,
         job_title     = EXCLUDED.job_title,
         phone         = EXCLUDED.phone,
         avatar_url    = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
         updated_at    = now()`,
      [userId, tenantId, display_name ?? user.name ?? user.email ?? userId, timezone ?? null, job_title ?? null, phone ?? null, avatar_url ?? null],
    )

    const result = await pool.query("SELECT * FROM user_profiles WHERE user_id = $1", [userId])
    return reply.code(200).send(result.rows[0])
  })
}
