// apps/api/src/routes/rag.ts
// Nextcloud RAG — scoped semantic search, KG query, chat, ingest trigger, external API
import type { FastifyInstance } from 'fastify'
import OpenAI from 'openai'
import pgvector from 'pgvector/pg'
import { requireRole } from '../plugins/require-role.js'

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})
const N8N_INTERNAL = process.env.N8N_INTERNAL_URL ?? 'http://n8n:5678'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? 'default'
}

async function embedQuery(query: string): Promise<number[]> {
  const result = await openai.embeddings.create({
    model: 'gemini-embedding-001',
    input: query,
    dimensions: 768,
  } as any)
  return result.data[0].embedding
}

export async function ragRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // ── POST /api/v1/rag/nextcloud/search ────────────────────────────────────────
  // Semantic search — returns chunks + similarity scores
  fastify.post('/api/v1/rag/nextcloud/search', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const { query, scope, top_k = 10 } = request.body as {
          query: string
          scope?: string
          top_k?: number
        }
        if (!query?.trim()) {
          return reply.code(400).send({ error: 'query is required' })
        }

        const tenantId = getTenantId(request)
        const vec = pgvector.toSql(await embedQuery(query))

        const scopeFilter = scope ? `AND folder_scope LIKE $3` : ''
        const params: any[] = [tenantId, vec]
        if (scope) params.push(`${scope}%`)

        const result = await pool.query(
          `SELECT id, text, file_path, file_name, folder_scope, metadata,
                  1 - (embedding <=> $2) AS similarity
           FROM nextcloud_rag_chunks
           WHERE tenant_id = $1 ${scopeFilter}
             AND embedding IS NOT NULL
           ORDER BY embedding <=> $2 ASC
           LIMIT ${Math.min(top_k, 50)}`,
          params,
        )

        return reply.code(200).send({ chunks: result.rows })
      } catch (err) {
        fastify.log.error({ err }, 'RAG search error')
        return reply.code(502).send({ error: 'Search unavailable' })
      }
    },
  })

  // ── POST /api/v1/rag/nextcloud/chat ──────────────────────────────────────────
  // Scoped RAG chat — retrieves top chunks then calls Gemini
  fastify.post('/api/v1/rag/nextcloud/chat', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const { query, scope, top_k = 8 } = request.body as {
          query: string
          scope?: string
          top_k?: number
        }
        if (!query?.trim()) {
          return reply.code(400).send({ error: 'query is required' })
        }

        const tenantId = getTenantId(request)
        const vec = pgvector.toSql(await embedQuery(query))

        const scopeFilter = scope ? `AND folder_scope LIKE $3` : ''
        const params: any[] = [tenantId, vec]
        if (scope) params.push(`${scope}%`)

        const chunks = await pool.query(
          `SELECT text, file_path, file_name, folder_scope,
                  1 - (embedding <=> $2) AS similarity
           FROM nextcloud_rag_chunks
           WHERE tenant_id = $1 ${scopeFilter}
             AND embedding IS NOT NULL
           ORDER BY embedding <=> $2 ASC
           LIMIT ${Math.min(top_k, 20)}`,
          params,
        )

        const rows = chunks.rows as Array<{
          text: string
          file_path: string
          file_name: string
          folder_scope: string
          similarity: number
        }>

        const context = rows.length > 0
          ? rows.map((r) => `[${r.file_name}]\n${r.text}`).join('\n\n---\n\n')
          : ''

        const scopeLabel = scope
          ? `Scope: ${scope.split('/').pop() ?? scope}`
          : 'All Nextcloud content'

        const systemMsg = rows.length > 0
          ? `You are a document assistant with access to Nextcloud files (${scopeLabel}). Answer using only the retrieved document content below. Cite file names. Be concise.\n\n${context}`
          : `You are a document assistant. No matching documents were found in Nextcloud for this query (${scopeLabel}).`

        const completion = await openai.chat.completions.create({
          model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.1-pro-preview',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: query },
          ],
        })

        const response = completion.choices[0].message.content ?? ''

        // Deduplicated source refs
        const seen = new Set<string>()
        const source_refs = rows
          .filter((r) => {
            if (seen.has(r.file_path)) return false
            seen.add(r.file_path)
            return true
          })
          .map((r) => ({ file_name: r.file_name, file_path: r.file_path, folder_scope: r.folder_scope }))

        return reply.code(200).send({ response, source_refs })
      } catch (err) {
        fastify.log.error({ err }, 'RAG chat error')
        return reply.code(502).send({ error: 'Chat unavailable' })
      }
    },
  })

  // ── GET /api/v1/rag/nextcloud/graph ──────────────────────────────────────────
  // Entity list with optional type/scope/text filter
  fastify.get('/api/v1/rag/nextcloud/graph', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const tenantId = getTenantId(request)
        const { type, scope, q, limit = '100' } = request.query as {
          type?: string
          scope?: string
          q?: string
          limit?: string
        }

        const conditions: string[] = ['e.tenant_id = $1']
        const params: any[] = [tenantId]
        let idx = 2

        if (type) {
          conditions.push(`e.entity_type = $${idx++}`)
          params.push(type)
        }
        if (scope) {
          conditions.push(`(e.folder_scope LIKE $${idx} OR e.folder_scope IS NULL)`)
          params.push(`${scope}%`)
          idx++
        }
        if (q) {
          conditions.push(`e.name ILIKE $${idx++}`)
          params.push(`%${q}%`)
        }

        const result = await pool.query(
          `SELECT e.id, e.entity_type, e.name, e.aliases, e.properties, e.folder_scope,
                  array_length(e.source_paths, 1) AS source_count
           FROM kg_entities e
           WHERE ${conditions.join(' AND ')}
           ORDER BY e.name
           LIMIT ${Math.min(parseInt(limit, 10) || 100, 500)}`,
          params,
        )

        const entityIds = result.rows.map((e: any) => e.id)
        let links: any[] = []
        if (entityIds.length > 0) {
          const relResult = await pool.query(
            `SELECT from_id AS source, to_id AS target, rel_type, weight
             FROM kg_relationships
             WHERE tenant_id = $1
               AND from_id = ANY($2::uuid[])
             LIMIT 2000`,
            [tenantId, entityIds],
          )
          links = relResult.rows
        }

        return reply.code(200).send({ entities: result.rows, links })
      } catch (err) {
        fastify.log.error({ err }, 'KG graph list error')
        return reply.code(500).send({ error: 'KG unavailable' })
      }
    },
  })

  // ── GET /api/v1/rag/nextcloud/graph/entity/:id ────────────────────────────────
  // Entity drilldown — entity + outgoing/incoming edges + source docs
  fastify.get('/api/v1/rag/nextcloud/graph/entity/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const tenantId = getTenantId(request)
        const { id } = request.params as { id: string }

        const entityRes = await pool.query(
          `SELECT * FROM kg_entities WHERE id = $1 AND tenant_id = $2`,
          [id, tenantId],
        )
        if (entityRes.rows.length === 0) {
          return reply.code(404).send({ error: 'Entity not found' })
        }
        const entity = entityRes.rows[0]

        const relRes = await pool.query(
          `SELECT r.id, r.rel_type, r.weight, r.context, r.source_path,
                  e.id AS to_id, e.entity_type AS to_type, e.name AS to_name
           FROM kg_relationships r
           JOIN kg_entities e ON e.id = r.to_id
           WHERE r.from_id = $1 AND r.tenant_id = $2
           ORDER BY r.weight DESC
           LIMIT 100`,
          [id, tenantId],
        )

        const sourceDocs = (entity.source_paths ?? []).map((p: string) => ({
          file_path: p,
          file_name: p.split('/').pop() ?? p,
        }))

        return reply.code(200).send({
          entity,
          relationships: relRes.rows,
          source_docs: sourceDocs,
        })
      } catch (err) {
        fastify.log.error({ err }, 'KG entity drilldown error')
        return reply.code(500).send({ error: 'KG unavailable' })
      }
    },
  })

  // ── POST /api/v1/rag/nextcloud/ingest  (admin only) ──────────────────────────
  // Manual trigger — calls n8n Auto Sync webhook for a specific path or all of GDrive-Sync
  fastify.post('/api/v1/rag/nextcloud/ingest', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      try {
        const { path } = (request.body ?? {}) as { path?: string }
        const payload = { trigger: 'manual', path: path ?? 'GDrive-Sync' }

        const res = await fetch(`${N8N_INTERNAL}/webhook/nextcloud-rag-autosync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const text = await res.text()
          fastify.log.warn({ status: res.status, text }, 'n8n autosync trigger failed')
          return reply.code(502).send({ error: 'n8n trigger failed', detail: text })
        }

        return reply.code(200).send({ ok: true, triggered: payload })
      } catch (err) {
        fastify.log.error({ err }, 'Ingest trigger error')
        return reply.code(502).send({ error: 'n8n unavailable' })
      }
    },
  })

  // ── POST /api/v1/rag/nextcloud/extract-entities  (internal — called from n8n) ──
  // Extracts KG entities from text via Gemini, upserts into DB
  // No JWT required — internal Docker-network endpoint only, not exposed via Traefik
  fastify.post('/api/v1/rag/nextcloud/extract-entities', {
    handler: async (request: any, reply: any) => {
      try {
        const { text, file_path, folder_scope, tenant_id: bodyTenant } = request.body as {
          text: string
          file_path: string
          folder_scope: string
          tenant_id?: string
        }
        if (!text?.trim() || !file_path) {
          return reply.code(400).send({ error: 'text and file_path are required' })
        }

        const tenantId = bodyTenant ?? getTenantId(request)

        const completion = await openai.chat.completions.create({
          model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.1-pro-preview',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Extract entities and relationships from this text. Return JSON: { "entities": [{"type": "person|company|project|concept|location|date", "name": "...", "aliases": [], "properties": {}}], "relationships": [{"from": "entity name", "to": "entity name", "rel_type": "works_for|mentioned_in|related_to|contracts_with|...", "context": "sentence where found"}] }',
            },
            { role: 'user', content: text.slice(0, 8000) },
          ],
        })

        const raw = JSON.parse(completion.choices[0].message.content ?? '{}')
        const entities: Array<{ type: string; name: string; aliases?: string[]; properties?: Record<string, unknown> }> = raw.entities ?? []
        const relationships: Array<{ from: string; to: string; rel_type: string; context?: string }> = raw.relationships ?? []

        // Upsert entities
        const entityIdMap = new Map<string, string>()
        for (const ent of entities) {
          if (!ent.name || !ent.type) continue
          const res = await pool.query(
            `INSERT INTO kg_entities (tenant_id, entity_type, name, aliases, properties, source_paths, folder_scope)
             VALUES ($1, $2, $3, $4, $5, ARRAY[$6]::TEXT[], $7)
             ON CONFLICT (tenant_id, name, entity_type) DO UPDATE
               SET aliases      = array(SELECT DISTINCT unnest(kg_entities.aliases || EXCLUDED.aliases)),
                   properties   = kg_entities.properties || EXCLUDED.properties,
                   source_paths = array(SELECT DISTINCT unnest(kg_entities.source_paths || EXCLUDED.source_paths)),
                   folder_scope = COALESCE(EXCLUDED.folder_scope, kg_entities.folder_scope),
                   updated_at   = now()
             RETURNING id`,
            [tenantId, ent.type, ent.name, ent.aliases ?? [], ent.properties ?? {}, file_path, folder_scope],
          )
          entityIdMap.set(ent.name, res.rows[0].id)
        }

        // Insert relationships
        let relCount = 0
        for (const rel of relationships) {
          const fromId = entityIdMap.get(rel.from)
          const toId = entityIdMap.get(rel.to)
          if (!fromId || !toId) continue
          await pool.query(
            `INSERT INTO kg_relationships (tenant_id, from_id, to_id, rel_type, context, source_path)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenantId, fromId, toId, rel.rel_type, rel.context ?? null, file_path],
          )
          relCount++
        }

        return reply.code(200).send({
          entities_upserted: entityIdMap.size,
          relationships_inserted: relCount,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Entity extract error')
        return reply.code(502).send({ error: 'Entity extraction failed' })
      }
    },
  })

  // ── POST /api/v1/rag/query  (external — API key auth, no JWT) ────────────────
  fastify.post('/api/v1/rag/query', {
    preHandler: [fastify.verifyApiKey],
    handler: async (request: any, reply: any) => {
      try {
        const { query, scope, top_k = 8, include_chunks = false } = request.body as {
          query: string
          scope?: string
          top_k?: number
          include_chunks?: boolean
        }
        if (!query?.trim()) {
          return reply.code(400).send({ error: 'query is required' })
        }

        const tenantId = request.apiKeyTenant ?? 'default'
        const vec = pgvector.toSql(await embedQuery(query))

        const scopeFilter = scope ? `AND folder_scope LIKE $3` : ''
        const params: any[] = [tenantId, vec]
        if (scope) params.push(`${scope}%`)

        const chunks = await pool.query(
          `SELECT text, file_path, file_name, folder_scope,
                  1 - (embedding <=> $2) AS similarity
           FROM nextcloud_rag_chunks
           WHERE tenant_id = $1 ${scopeFilter}
             AND embedding IS NOT NULL
           ORDER BY embedding <=> $2 ASC
           LIMIT ${Math.min(top_k, 20)}`,
          params,
        )

        const rows = chunks.rows as Array<{
          text: string; file_path: string; file_name: string; folder_scope: string; similarity: number
        }>

        const context = rows.length > 0
          ? rows.map((r) => `[${r.file_name}]\n${r.text}`).join('\n\n---\n\n')
          : ''

        const systemMsg = rows.length > 0
          ? `You are a document assistant. Answer using only the content below. Cite file names.\n\n${context}`
          : 'No matching documents found for this query.'

        const completion = await openai.chat.completions.create({
          model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.1-pro-preview',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: query },
          ],
        })

        const answer = completion.choices[0].message.content ?? ''

        const seen = new Set<string>()
        const sources = rows
          .filter((r) => { if (seen.has(r.file_path)) return false; seen.add(r.file_path); return true })
          .map((r) => ({ file_name: r.file_name, file_path: r.file_path }))

        const response: Record<string, unknown> = { answer, sources }
        if (include_chunks) response.chunks = rows

        return reply.code(200).send(response)
      } catch (err) {
        fastify.log.error({ err }, 'External RAG query error')
        return reply.code(502).send({ error: 'RAG query failed' })
      }
    },
  })
}
