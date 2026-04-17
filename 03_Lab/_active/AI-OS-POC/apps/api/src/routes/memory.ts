import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import OpenAI from "openai";
import pgvector from "pgvector/pg";
import { Client, Connection } from "@temporalio/client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Lazy Temporal client singleton
let temporalClient: Client | undefined;
let temporalConnection: Connection | undefined;

async function getTemporalClient(): Promise<Client> {
  if (!temporalClient) {
    temporalConnection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? "temporal:7233",
    });
    temporalClient = new Client({
      connection: temporalConnection,
      namespace: process.env.TEMPORAL_NAMESPACE ?? "aios",
    });
  }
  return temporalClient;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: text.trim(),
  });
  return response.data[0].embedding;
}

export async function memoryRoutes(fastify: FastifyInstance) {
  // Close Temporal connection on server shutdown
  fastify.addHook("onClose", async () => {
    if (temporalConnection) {
      await temporalConnection.close();
    }
  });

  // POST /api/v1/memory/write — OIDC-protected, embeds content via OpenAI and stores in postgres
  fastify.post<{ Body: { content: string; namespace: string } }>(
    "/api/v1/memory/write",
    { preHandler: [(fastify as any).authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { content, namespace } = request.body as { content: string; namespace: string };
      if (!content || !namespace) {
        return reply.status(400).send({ error: "content and namespace are required" });
      }
      const tenantId = (request as any).user?.sub;
      if (!tenantId) {
        return reply.status(401).send({ error: "tenant ID missing from token" });
      }

      const embedding = await getEmbedding(content);
      const pool = (fastify as any).pool;
      const result = await pool.query(
        `INSERT INTO memory_entries (content, namespace, tenant_id, embedding)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [content, namespace, tenantId, pgvector.toSql(embedding)]
      );
      return reply.status(201).send({ id: result.rows[0].id });
    }
  );

  // POST /api/v1/memory/retrieve — OIDC-protected, returns similarity-ranked results
  fastify.post<{ Body: { query: string; namespace?: string; top_k?: number } }>(
    "/api/v1/memory/retrieve",
    { preHandler: [(fastify as any).authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { query, namespace, top_k = 5 } = request.body as {
        query: string;
        namespace?: string;
        top_k?: number;
      };
      if (!query) {
        return reply.status(400).send({ error: "query is required" });
      }
      const tenantId = (request as any).user?.sub;
      if (!tenantId) {
        return reply.status(401).send({ error: "tenant ID missing from token" });
      }

      const embedding = await getEmbedding(query);
      const pool = (fastify as any).pool;

      let rows: any[];
      if (namespace) {
        // Filter by namespace — HNSW index engages via ascending distance order
        const result = await pool.query(
          `SELECT id, content, namespace, 1 - (embedding <=> $1) AS similarity
           FROM memory_entries
           WHERE tenant_id = $2 AND namespace = $3
           ORDER BY embedding <=> $1
           LIMIT $4`,
          [pgvector.toSql(embedding), tenantId, namespace, top_k]
        );
        rows = result.rows;
      } else {
        const result = await pool.query(
          `SELECT id, content, namespace, 1 - (embedding <=> $1) AS similarity
           FROM memory_entries
           WHERE tenant_id = $2
           ORDER BY embedding <=> $1
           LIMIT $3`,
          [pgvector.toSql(embedding), tenantId, top_k]
        );
        rows = result.rows;
      }

      return reply.send({ results: rows });
    }
  );

  // POST /internal/memory/write — NO OIDC, network isolation is the guard (app_net only)
  // Worker passes pre-computed embedding — skips OpenAI call
  fastify.post<{
    Body: { content: string; embedding: number[]; namespace: string; tenantId: string };
  }>(
    "/internal/memory/write",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { content, embedding, namespace, tenantId } = request.body as {
        content: string;
        embedding: number[];
        namespace: string;
        tenantId: string;
      };
      if (!content || !embedding || !namespace || !tenantId) {
        return reply
          .status(400)
          .send({ error: "content, embedding, namespace, and tenantId are required" });
      }
      const pool = (fastify as any).pool;
      const result = await pool.query(
        `INSERT INTO memory_entries (content, namespace, tenant_id, embedding)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [content, namespace, tenantId, pgvector.toSql(embedding)]
      );
      return reply.status(201).send({ id: result.rows[0].id });
    }
  );

  // POST /api/v1/documents/ingest — OIDC-protected, triggers Temporal document-ingestion workflow
  fastify.post<{ Body: { documentId: number } }>(
    "/api/v1/documents/ingest",
    { preHandler: [(fastify as any).authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { documentId } = request.body as { documentId: number };
      if (!documentId) {
        return reply.status(400).send({ error: "documentId is required" });
      }
      const tenantId = (request as any).user?.sub;
      if (!tenantId) {
        return reply.status(401).send({ error: "tenant ID missing from token" });
      }

      const client = await getTemporalClient();
      const handle = await client.workflow.start("documentIngestionWorkflow", {
        taskQueue: "document-ingestion",
        args: [{ documentId, tenantId }],
        workflowId: `doc-ingest-${documentId}-${Date.now()}`,
      });

      return reply.status(202).send({ workflowId: handle.workflowId });
    }
  );
}
