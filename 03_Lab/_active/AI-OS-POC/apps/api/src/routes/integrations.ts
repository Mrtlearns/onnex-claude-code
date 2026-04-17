// apps/api/src/routes/integrations.ts
// Phase 13: External integration webhook receivers
// GitHub and GitLab issue → task sync
import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true // skip verification if no secret configured
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function verifyGitLabToken(token: string, secret: string): boolean {
  if (!secret) return true
  return token === secret
}

export async function integrationsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // POST /api/v1/integrations/github/issues — GitHub issue webhook
  // Trigger: Issues events (opened, closed, reopened, edited, assigned)
  fastify.post('/api/v1/integrations/github/issues', {
    config: { rawBody: true },
    handler: async (request: any, reply: any) => {
      // Verify signature
      const githubSecret = process.env.GITHUB_WEBHOOK_SECRET ?? ''
      const signature = request.headers['x-hub-signature-256'] ?? ''
      const rawBody = (request as any).rawBody ?? JSON.stringify(request.body)

      if (githubSecret && !verifyGitHubSignature(rawBody, signature, githubSecret)) {
        return reply.code(401).send({ error: 'Invalid signature' })
      }

      const event = request.headers['x-github-event']
      const payload = request.body as any

      if (event !== 'issues') {
        return reply.code(200).send({ skipped: true })
      }

      const action = payload.action
      const issue = payload.issue
      const tenantId = request.headers['x-tenant-id'] as string

      if (!tenantId) {
        return reply.code(400).send({ error: 'x-tenant-id header required' })
      }

      if (action === 'opened') {
        // Create task from issue
        const result = await pool.query(
          `INSERT INTO tasks
             (tenant_id, title, description, status, external_id, external_source)
           VALUES ($1, $2, $3, 'Backlog', $4, 'github')
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            tenantId,
            issue.title,
            issue.body ?? null,
            String(issue.id),
          ]
        )
        return reply.code(201).send({ task: result.rows[0] ?? null })
      }

      if (action === 'closed') {
        // Mark matching task as Done
        await pool.query(
          `UPDATE tasks SET status = 'Done'
           WHERE tenant_id = $1 AND external_id = $2 AND external_source = 'github'`,
          [tenantId, String(issue.id)]
        )
        return reply.code(200).send({ synced: true })
      }

      if (action === 'reopened') {
        await pool.query(
          `UPDATE tasks SET status = 'Backlog'
           WHERE tenant_id = $1 AND external_id = $2 AND external_source = 'github'`,
          [tenantId, String(issue.id)]
        )
        return reply.code(200).send({ synced: true })
      }

      return reply.code(200).send({ skipped: true })
    },
  })

  // POST /api/v1/integrations/gitlab/issues — GitLab issue webhook
  fastify.post('/api/v1/integrations/gitlab/issues', {
    handler: async (request: any, reply: any) => {
      const gitlabSecret = process.env.GITLAB_WEBHOOK_SECRET ?? ''
      const token = request.headers['x-gitlab-token'] ?? ''

      if (!verifyGitLabToken(token as string, gitlabSecret)) {
        return reply.code(401).send({ error: 'Invalid token' })
      }

      const payload = request.body as any
      const tenantId = request.headers['x-tenant-id'] as string

      if (!tenantId) {
        return reply.code(400).send({ error: 'x-tenant-id header required' })
      }

      if (payload.object_kind !== 'issue') {
        return reply.code(200).send({ skipped: true })
      }

      const issue = payload.object_attributes
      const action = issue.action // 'open' | 'close' | 'reopen' | 'update'

      if (action === 'open') {
        const result = await pool.query(
          `INSERT INTO tasks
             (tenant_id, title, description, status, external_id, external_source)
           VALUES ($1, $2, $3, 'Backlog', $4, 'gitlab')
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            tenantId,
            issue.title,
            issue.description ?? null,
            String(issue.iid),
          ]
        )
        return reply.code(201).send({ task: result.rows[0] ?? null })
      }

      if (action === 'close') {
        await pool.query(
          `UPDATE tasks SET status = 'Done'
           WHERE tenant_id = $1 AND external_id = $2 AND external_source = 'gitlab'`,
          [tenantId, String(issue.iid)]
        )
        return reply.code(200).send({ synced: true })
      }

      if (action === 'reopen') {
        await pool.query(
          `UPDATE tasks SET status = 'Backlog'
           WHERE tenant_id = $1 AND external_id = $2 AND external_source = 'gitlab'`,
          [tenantId, String(issue.iid)]
        )
        return reply.code(200).send({ synced: true })
      }

      return reply.code(200).send({ skipped: true })
    },
  })

  // GET /api/v1/integrations/config — return current integration config (webhook URLs for display)
  fastify.get('/api/v1/integrations/config', {
    preHandler: [(fastify as any).authenticate],
    handler: async (_request: any, reply: any) => {
      const baseUrl = process.env.PUBLIC_URL ?? 'https://your-domain.com'
      return reply.code(200).send({
        github: {
          webhook_url: `${baseUrl}/api/v1/integrations/github/issues`,
          events: ['Issues'],
          secret_env: 'GITHUB_WEBHOOK_SECRET',
        },
        gitlab: {
          webhook_url: `${baseUrl}/api/v1/integrations/gitlab/issues`,
          events: ['Issues events'],
          secret_env: 'GITLAB_WEBHOOK_SECRET',
        },
      })
    },
  })
}
