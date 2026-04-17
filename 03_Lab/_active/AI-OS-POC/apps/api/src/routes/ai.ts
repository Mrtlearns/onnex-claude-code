// apps/api/src/routes/ai.ts
// Phase 12: AI Assistant — RAG chat + memory stats/clear
import type { FastifyInstance } from 'fastify'
import OpenAI from 'openai'
import pgvector from 'pgvector/pg'
import { requireRole } from '../plugins/require-role.js'

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function aiRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // -------------------------------------------------------------------------
  // POST /api/v1/ai/chat — RAG chat with pgvector memory retrieval
  // -------------------------------------------------------------------------
  fastify.post('/api/v1/ai/chat', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const { query } = request.body as { query: string }
        const tenantId = getTenantId(request)

        // 1. Embed the query
        const embeddingResult = await openai.embeddings.create({
          model: 'gemini-embedding-001',
          input: query,
          dimensions: 768,
        } as any)
        const embedding = embeddingResult.data[0].embedding

        // 2. pgvector cosine similarity search — top 5 entries for tenant
        const vectorSql = pgvector.toSql(embedding)
        const memResult = await pool.query(
          `SELECT id, content, source_type, source_id,
                  1 - (embedding <=> $2) AS similarity
           FROM memory_entries
           WHERE tenant_id = $1
           ORDER BY embedding <=> $2 ASC
           LIMIT 5`,
          [tenantId, vectorSql],
        )
        const rows: Array<{
          id: string
          content: string
          source_type: string | null
          source_id: string | null
          similarity: number
        }> = memResult.rows

        // 3. Build context string
        const context = rows.length > 0
          ? rows.map((r) => r.content).join('\n\n')
          : ''

        const systemContent = rows.length > 0
          ? `You are a helpful agency operations assistant. Answer based on this workspace context:\n${context}`
          : 'You are a helpful agency operations assistant. No workspace context was found for this query.'

        // 4. Build source_refs — deduplicated by source_id, only rows with source_type
        const seen = new Set<string>()
        const source_refs: Array<{ entity_type: string; entity_id: string; label: string }> = []
        for (const row of rows) {
          if (row.source_type && row.source_id && !seen.has(row.source_id)) {
            seen.add(row.source_id)
            source_refs.push({
              entity_type: row.source_type,
              entity_id: row.source_id,
              label: row.content.slice(0, 60),
            })
          }
        }

        // 5. Call Gemini (preview → stable fallback handled by caller retry if needed)
        const completion = await openai.chat.completions.create({
          model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.1-pro-preview',
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: query },
          ],
        })

        const response = completion.choices[0].message.content ?? ''

        return reply.code(200).send({ response, source_refs })
      } catch (err: any) {
        fastify.log.error({ err }, 'AI chat error')
        if (err?.status === 429) {
          return reply.code(503).send({ error: 'AI quota exceeded — check Gemini API quota at console.cloud.google.com' })
        }
        return reply.code(502).send({ error: 'AI service unavailable' })
      }
    },
  })

  // -------------------------------------------------------------------------
  // GET /api/v1/ai/memory/stats — entry count + vector storage bytes (admin)
  // -------------------------------------------------------------------------
  fastify.get('/api/v1/ai/memory/stats', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const result = await pool.query(
        `SELECT COUNT(*) AS entry_count,
                COALESCE(SUM(pg_column_size(embedding)), 0) AS vector_storage_bytes
         FROM memory_entries
         WHERE tenant_id = $1`,
        [tenantId],
      )
      const row = result.rows[0] ?? {}
      return reply.code(200).send({
        entry_count: Number(row.entry_count ?? 0),
        vector_storage_bytes: Number(row.vector_storage_bytes ?? 0),
      })
    },
  })

  // -------------------------------------------------------------------------
  // DELETE /api/v1/ai/memory — clear all memory entries for tenant (admin)
  // -------------------------------------------------------------------------
  fastify.delete('/api/v1/ai/memory', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const result = await pool.query(
        `DELETE FROM memory_entries WHERE tenant_id = $1 RETURNING id`,
        [tenantId],
      )
      return reply.code(200).send({ deleted: result.rows.length })
    },
  })
}
