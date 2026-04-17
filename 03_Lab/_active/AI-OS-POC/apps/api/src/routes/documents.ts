import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const PAPERLESS_URL = process.env.PAPERLESS_URL ?? "http://paperless-web:8000";
const PAPERLESS_TOKEN = process.env.PAPERLESS_AI_API_TOKEN ?? "";

export async function documentRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool;

  fastify.post<{ Body: { filename: string; nextcloud_url: string } }>(
    "/api/v1/documents",
    { preHandler: [(fastify as any).authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { filename, nextcloud_url } = request.body as { filename: string; nextcloud_url: string };
      if (!filename || !nextcloud_url) {
        return reply.status(400).send({ error: "filename and nextcloud_url are required" });
      }
      const tenantId = (request as any).user?.sub ?? "system";
      const result = await pool.query(
        "INSERT INTO documents (filename, nextcloud_url, tenant_id) VALUES ($1,$2,$3) RETURNING *",
        [filename, nextcloud_url, tenantId]
      );
      return reply.status(201).send(result.rows[0]);
    }
  );

  fastify.get(
    "/api/v1/documents",
    { preHandler: [(fastify as any).authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).user?.sub ?? "system";
      const result = await pool.query(
        "SELECT * FROM documents WHERE tenant_id=$1 ORDER BY created_at DESC",
        [tenantId]
      );
      return reply.send({ count: result.rowCount, results: result.rows });
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/api/v1/documents/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).user?.sub ?? "system";
      const result = await pool.query(
        "SELECT * FROM documents WHERE id=$1 AND tenant_id=$2",
        [id, tenantId]
      );
      if (!result.rows.length) return reply.status(404).send({ error: "not found" });
      return reply.send(result.rows[0]);
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: { paperless_tags?: string[]; paperless_correspondent?: string };
  }>(
    "/api/v1/documents/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { paperless_tags, paperless_correspondent } = request.body as {
        paperless_tags?: string[];
        paperless_correspondent?: string;
      };
      const tenantId = (request as any).user?.sub ?? "system";
      const current = await pool.query(
        "SELECT * FROM documents WHERE id=$1 AND tenant_id=$2",
        [id, tenantId]
      );
      if (!current.rows.length) return reply.status(404).send({ error: "not found" });
      const doc = current.rows[0];
      const updated = await pool.query(
        `UPDATE documents SET
           paperless_tags = COALESCE($1, paperless_tags),
           paperless_correspondent = COALESCE($2, paperless_correspondent)
         WHERE id=$3
         RETURNING *`,
        [paperless_tags ?? null, paperless_correspondent ?? null, id]
      );
      if (doc.paperless_id && PAPERLESS_TOKEN) {
        const body: Record<string, unknown> = {};
        if (paperless_correspondent) body.correspondent = paperless_correspondent;
        if (paperless_tags) body.tags = paperless_tags;
        if (Object.keys(body).length) {
          await fetch(`${PAPERLESS_URL}/api/documents/${doc.paperless_id}/`, {
            method: "PATCH",
            headers: {
              Authorization: `Token ${PAPERLESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }).catch((e) => fastify.log.warn(`Paperless mirror failed: ${e.message}`));
        }
      }
      return reply.send(updated.rows[0]);
    }
  );

  fastify.patch<{ Params: { id: string }; Body: { memory_entry_id: string } }>(
    "/internal/documents/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { memory_entry_id } = request.body as { memory_entry_id: string };
      const result = await pool.query(
        "UPDATE documents SET memory_entry_id=$1 WHERE id=$2 RETURNING id, memory_entry_id",
        [memory_entry_id, id]
      );
      if (!result.rows.length) return reply.status(404).send({ error: "Document not found" });
      return reply.send(result.rows[0]);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/internal/documents/:id/content",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const resp = await fetch(`${PAPERLESS_URL}/api/documents/${id}/content/`, {
        headers: { Authorization: `Token ${PAPERLESS_TOKEN}` },
      });
      if (!resp.ok) return reply.code(resp.status).send({ error: "Paperless fetch failed" });
      const text = await resp.text();
      return reply.type("text/plain").send(text);
    }
  );

  fastify.post<{ Body: { document_id: number; tenant_id?: string } }>(
    "/internal/webhooks/paperless/document-consumed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { document_id, tenant_id = "system" } = request.body as {
        document_id: number;
        tenant_id?: string;
      };
      if (!document_id) return reply.status(400).send({ error: "document_id required" });
      const papResp = await fetch(`${PAPERLESS_URL}/api/documents/${document_id}/`, {
        headers: { Authorization: `Token ${PAPERLESS_TOKEN}` },
      });
      if (!papResp.ok) {
        return reply.status(502).send({ error: `Paperless API error: ${papResp.status}` });
      }
      const papDoc = await papResp.json() as {
        id: number;
        title: string;
        original_file_name: string;
        tags: number[];
        correspondent: number | null;
      };
      const result = await pool.query(
        `INSERT INTO documents (filename, paperless_id, paperless_title, tenant_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (paperless_id) DO UPDATE SET
           paperless_title=EXCLUDED.paperless_title,
           synced_at=now()
         RETURNING id, paperless_id, (xmax = 0) AS is_new`,
        [papDoc.original_file_name, papDoc.id, papDoc.title, tenant_id]
      );
      fastify.log.info(`Paperless webhook: upserted doc ${document_id} -> aios id ${result.rows[0].id} (is_new=${result.rows[0].is_new})`);
      return reply.status(202).send({
        id: result.rows[0].id,
        paperless_id: document_id,
        is_new: result.rows[0].is_new,
      });
    }
  );

  fastify.get<{ Params: { source: string } }>(
    "/internal/sync-cursor/:source",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { source } = request.params as { source: string };
      const result = await pool.query(
        "SELECT last_synced FROM sync_cursors WHERE source=$1",
        [source]
      );
      if (!result.rows.length) return reply.status(404).send({ error: "cursor not found" });
      return reply.send({ source, last_synced: result.rows[0].last_synced });
    }
  );

  fastify.put<{ Params: { source: string }; Body: { last_synced: string } }>(
    "/internal/sync-cursor/:source",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { source } = request.params as { source: string };
      const { last_synced } = request.body as { last_synced: string };
      await pool.query(
        "UPDATE sync_cursors SET last_synced=$1 WHERE source=$2",
        [last_synced, source]
      );
      return reply.send({ source, last_synced });
    }
  );
}
