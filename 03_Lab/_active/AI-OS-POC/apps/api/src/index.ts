import Fastify from "fastify";
import cors from "@fastify/cors";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import fastifyMetrics from "fastify-metrics";
import { Pool } from "pg";
import pgvector from "pgvector/pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
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
// Phase 10: Documents + Dashboard + Notifications
import { documentsPhase10Routes } from "./routes/documents.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { cronRoutes } from "./routes/cron.js";
// Phase 11: Reports + Admin
import { reportsRoutes } from "./routes/reports.js";
import { adminRoutes } from "./routes/admin.js";
// Phase 12: Settings + AI Assistant + Client Portal
import { settingsRoutes } from "./routes/settings.js";
import { aiRoutes } from "./routes/ai.js";
import { portalRoutes } from "./routes/portal.js";
import { demoRoutes } from "./routes/demo.js";
// Phase 13: Gantt / AI Task Pickup / External Integrations
import { integrationsRoutes } from "./routes/integrations.js"
// AI Brain — SOP runner + job runs
import { brainRoutes } from "./routes/brain.js";
// Nextcloud RAG — semantic search, KG, external API
import { ragRoutes } from "./routes/rag.js";
import { apiKeyAuthPlugin } from "./plugins/api-key-auth.js";
// Document signing — LibreSign integration
import { documentSignRoutes } from "./routes/document-sign.js"
// Staff people-picker
import { staffRoutes } from "./routes/staff.js";
// Plane integration proxy
import { planeRoutes } from "./routes/plane.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  // Phase 10 migration
  try {
    const sql010 = readFileSync(
      join(__dirname, "db/migrations/010_documents_dashboard_notifications.sql"),
      "utf8",
    );
    await pool.query(sql010);
  } catch (err) {
    // Log but don't crash — migration may already be applied
    console.warn("Migration 010 warning:", err);
  }

  // Phase 11 migration
  try {
    const sql011 = readFileSync(
      join(__dirname, "db/migrations/011_audit_log.sql"),
      "utf8",
    );
    await pool.query(sql011);
  } catch (err) {
    console.warn("Migration 011 warning:", err);
  }

  // Phase 12 migration — settings
  try {
    const sql012settings = readFileSync(
      join(__dirname, "db/migrations/012_settings.sql"),
      "utf8",
    );
    await pool.query(sql012settings);
  } catch (err) {
    console.warn("Migration 012_settings warning:", err);
  }

  // Phase 12 migration — portal
  try {
    const sql012portal = readFileSync(
      join(__dirname, "db/migrations/012_portal.sql"),
      "utf8",
    );
    await pool.query(sql012portal);
  } catch (err) {
    console.warn("Migration 012_portal warning:", err);
  }

  // Phase 13 migration — Gantt, AI task pickup, task dependencies
  try {
    const sql013 = readFileSync(
      join(__dirname, "db/migrations/013_gantt_ai.sql"),
      "utf8",
    );
    await pool.query(sql013);
  } catch (err) {
    console.warn("Migration 013 warning:", err);
  }

  // Phase 14 migration — storage settings
  try {
    const sql014 = readFileSync(
      join(__dirname, "db/migrations/014_storage_settings.sql"),
      "utf8",
    );
    await pool.query(sql014);
  } catch (err) {
    console.warn("Migration 014 warning:", err);
  }

  // AI Brain migration — brain_job_runs
  try {
    const sql015 = readFileSync(
      join(__dirname, "db/migrations/015_brain_jobs.sql"),
      "utf8",
    );
    await pool.query(sql015);
  } catch (err) {
    console.warn("Migration 015 warning:", err);
  }

  // AI Brain migration — sops table
  try {
    const sql016 = readFileSync(
      join(__dirname, "db/migrations/016_sops.sql"),
      "utf8",
    );
    await pool.query(sql016);
  } catch (err) {
    console.warn("Migration 016 warning:", err);
  }

  // Project detail upgrade — description, health, color, notes, members
  try {
    const sql017 = readFileSync(
      join(__dirname, "db/migrations/017_project_enhancements.sql"),
      "utf8",
    );
    await pool.query(sql017);
  } catch (err) {
    console.warn("Migration 017 warning:", err);
  }

  // Document fix — tenant_id TEXT, link_type, display_name, document_comments
  try {
    const sql018 = readFileSync(
      join(__dirname, "db/migrations/018_document_fix.sql"),
      "utf8",
    );
    await pool.query(sql018);
  } catch (err) {
    console.warn("Migration 018 warning:", err);
  }

  // Nextcloud RAG — chunk store, KG tables, API keys
  try {
    const sql019 = readFileSync(
      join(__dirname, "db/migrations/019_nextcloud_rag.sql"),
      "utf8",
    );
    await pool.query(sql019);
  } catch (err) {
    console.warn("Migration 019 warning:", err);
  }

  // Document signatures — LibreSign integration
  try {
    const sql020 = readFileSync(
      join(__dirname, "db/migrations/020_document_signatures.sql"),
      "utf8",
    );
    await pool.query(sql020);
  } catch (err) {
    console.warn("Migration 020 warning:", err);
  }

  // User profiles — staff onboarding
  try {
    const sql021 = readFileSync(
      join(__dirname, "db/migrations/021_user_profiles.sql"),
      "utf8",
    );
    await pool.query(sql021);
  } catch (err) {
    console.warn("Migration 021 warning:", err);
  }

  // Plane integration — user token + project link fields
  try {
    const sql025 = readFileSync(
      join(__dirname, "db/migrations/025_plane_integration.sql"),
      "utf8",
    );
    await pool.query(sql025);
  } catch (err) {
    console.warn("Migration 025 warning:", err);
  }
}

async function main() {
  await runMigrations();

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:3002"]
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await fastify.register(fastifyMetrics as any, { endpoint: '/metrics' });

  await fastify.register(authPlugin);
  await fastify.register(apiKeyAuthPlugin);

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
  // Phase 10: Documents + Dashboard + Notifications
  await fastify.register(documentsPhase10Routes);
  await fastify.register(notificationsRoutes);
  await fastify.register(dashboardRoutes);
  await fastify.register(cronRoutes);
  // Phase 11: Reports + Admin
  await fastify.register(reportsRoutes);
  await fastify.register(adminRoutes);
  // Phase 12: Settings + AI Assistant + Client Portal
  await fastify.register(settingsRoutes);
  await fastify.register(aiRoutes);
  await fastify.register(portalRoutes);
  await fastify.register(demoRoutes);
  // Phase 13: Gantt / AI Task Pickup / External Integrations
  await fastify.register(integrationsRoutes);
  // AI Brain
  await fastify.register(brainRoutes);
  // Nextcloud RAG
  await fastify.register(ragRoutes);
  // Document signing
  await fastify.register(documentSignRoutes);
  // Staff people-picker
  await fastify.register(staffRoutes);
  // Plane integration proxy
  await fastify.register(planeRoutes);

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info({ port: PORT }, "aios-api listening");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
