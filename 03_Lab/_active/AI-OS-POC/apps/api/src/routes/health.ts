import type { FastifyInstance } from "fastify";
import { createClient } from "redis";
import pg from "pg";

const { Client: PgClient } = pg;

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (_req, reply) => {
    return reply.code(200).send({ status: "ok", service: "aios-api" });
  });

  fastify.get("/ready", async (_req, reply) => {
    const checks: Record<string, string> = {};
    let allOk = true;

    // Check Postgres
    const pgClient = new PgClient({ connectionString: process.env.DATABASE_URL });
    try {
      await pgClient.connect();
      await pgClient.query("SELECT 1");
      await pgClient.end();
      checks.postgres = "ok";
    } catch (e) {
      checks.postgres = "error: " + (e as Error).message;
      allOk = false;
    }

    // Check Redis
    const redisClient = createClient({ url: process.env.REDIS_URL });
    try {
      await redisClient.connect();
      await redisClient.ping();
      await redisClient.disconnect();
      checks.redis = "ok";
    } catch (e) {
      checks.redis = "error: " + (e as Error).message;
      allOk = false;
    }

    return reply.code(allOk ? 200 : 503).send({ status: allOk ? "ready" : "not_ready", checks });
  });
}
