import type { FastifyInstance } from "fastify";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

const EMBEDDING_MODEL = "gemini-embedding-001";

export default async function embedRoutes(fastify: FastifyInstance) {
  // POST /api/v1/embed — accepts { text: string } and returns embedding vector
  // NOTE: No auth required in Phase 3 for verification ease. Phase 5 adds auth gate.
  fastify.post<{ Body: { text: string } }>("/api/v1/embed", async (request, reply) => {
    const { text } = request.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return reply.code(400).send({ error: "text field is required and must be a non-empty string" });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "REPLACE_WITH_REAL_KEY") {
      return reply.code(503).send({ error: "GEMINI_API_KEY not configured" });
    }

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.trim(),
        dimensions: 768,
      } as any);

      const embedding = response.data[0].embedding;

      return reply.code(200).send({
        embedding,
        dimensions: embedding.length,
        model: response.model,
        usage: {
          prompt_tokens: response.usage.prompt_tokens,
          total_tokens: response.usage.total_tokens
        }
      });
    } catch (err: any) {
      fastify.log.error({ err }, "Gemini embedding error");
      const status = err?.status ?? 500;
      return reply.code(status).send({
        error: "Embedding failed",
        message: err?.message ?? String(err)
      });
    }
  });

  // GET /api/v1/embed/status — quick check that Gemini API key is configured
  fastify.get("/api/v1/embed/status", async (_req, reply) => {
    const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "REPLACE_WITH_REAL_KEY");
    return reply.code(200).send({
      configured: hasKey,
      model: EMBEDDING_MODEL,
      dimensions: 768
    });
  });
}
