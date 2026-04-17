// apps/api/src/plugins/api-key-auth.ts
// Fastify plugin: validates X-RAG-API-KEY header for external API callers.
// Looks up the SHA-256 hash of the key, sets request.apiKeyTenant on success.

import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'node:crypto'

declare module 'fastify' {
  interface FastifyInstance {
    verifyApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    apiKeyTenant?: string
  }
}

export const apiKeyAuthPlugin = fp(async function apiKeyAuthPlugin(fastify: FastifyInstance) {
  fastify.decorate('verifyApiKey', async (request: FastifyRequest, reply: FastifyReply) => {
    const raw = request.headers['x-rag-api-key']
    if (!raw || typeof raw !== 'string') {
      return reply.code(401).send({ error: 'Missing X-RAG-API-KEY header' })
    }

    const hash = createHash('sha256').update(raw).digest('hex')
    const pool = (fastify as any).pool

    const result = await pool.query(
      `SELECT tenant_id FROM rag_api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL`,
      [hash],
    )

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Invalid or revoked API key' })
    }

    // Update last_used_at async — don't await to avoid blocking the request
    pool.query(
      'UPDATE rag_api_keys SET last_used_at = now() WHERE key_hash = $1',
      [hash],
    ).catch(() => {})

    request.apiKeyTenant = result.rows[0].tenant_id
  })
})
