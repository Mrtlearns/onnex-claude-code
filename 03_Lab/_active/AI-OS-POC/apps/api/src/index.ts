import Fastify from "fastify";
import cors from "@fastify/cors";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import fastifyMetrics from "fastify-metrics";
import { Pool } from "pg";
import pgvector from "pgvector/pg";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./routes/health.js";
import meRoutes from "./routes/me.js";
import embedRoutes from "./routes/embed.js";
import { documentRoutes } from "./routes/documents.js";
import { memoryRoutes } from "./routes/memory.js";
import { clientsRoutes } from "./routes/clients.js";
import { contactsRoutes } from "./routes/contacts.js";
import { projectsRoutes } from "./routes/projects.js";
import { tasksRoutes } from "./routes/tasks.js";
import { dealsRoutes } from "./routes/deals.js";
import { invoicesRoutes } from "./routes/invoices.js";
import { timeEntriesRoutes } from "./routes/time-entries.js";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: { target: "pino-pretty", options: { colorize: false } }
  }
});

const PORT = parseInt(process.env.API_PORT ?? "3001", 10);
const HOST = "0.0.0.0";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("connect", async (client) => {
  await pgvector.registerTypes(client);
});

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   TEXT NOT NULL,
      namespace   TEXT NOT NULL,
      content     TEXT NOT NULL,
      embedding   vector(1536),
      source_type TEXT,
      source_id   TEXT,
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS memory_entries_embedding_hnsw
      ON memory_entries USING hnsw (embedding vector_cosine_ops)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS memory_entries_tenant_idx
      ON memory_entries (tenant_id)
  `);
}

async function main() {
  await runMigrations();

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:3002"]
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await fastify.register(fastifyMetrics as any, { endpoint: '/metrics' });

  await fastify.register(authPlugin);

  fastify.decorate("pool", pool);

  await fastify.register(healthRoutes);
  await fastify.register(meRoutes);
  await fastify.register(embedRoutes);
  await fastify.register(documentRoutes);
  await fastify.register(memoryRoutes);
  await fastify.register(clientsRoutes);
  await fastify.register(contactsRoutes);
  await fastify.register(projectsRoutes);
  await fastify.register(tasksRoutes);
  // Phase 9: Financial Loop
  await fastify.register(dealsRoutes);
  await fastify.register(invoicesRoutes);
  await fastify.register(timeEntriesRoutes);

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info({ port: PORT }, "aios-api listening");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
