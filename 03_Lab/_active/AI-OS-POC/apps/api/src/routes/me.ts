import type { FastifyInstance } from "fastify";

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get("/api/v1/me", {
    preHandler: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    return reply.code(200).send({
      sub: user.sub,
      email: user.email ?? null,
      name: user.name ?? null,
      groups: user.groups ?? [],
      tenant_id: user.tenant_id ?? null
    });
  });
}
