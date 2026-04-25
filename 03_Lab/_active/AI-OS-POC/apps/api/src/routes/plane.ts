// apps/api/src/routes/plane.ts
// Plane API proxy — resolves per-user or workspace token, never exposes credentials to browser
import type { FastifyInstance } from 'fastify'

async function resolvePlane(pool: any, userId: string): Promise<{ token: string; baseUrl: string }> {
  // 1. Per-user token
  const userRes = await pool.query(
    'SELECT plane_api_token FROM user_profiles WHERE user_id = $1',
    [userId],
  )
  if (userRes.rows[0]?.plane_api_token) {
    const cfg = await pool.query(
      "SELECT value FROM workspace_settings WHERE key = 'plane'",
    )
    const baseUrl: string = cfg.rows[0]?.value?.base_url ?? 'https://plane.on-nex.us'
    return { token: userRes.rows[0].plane_api_token, baseUrl }
  }

  // 2. Workspace service token fallback
  const wsRes = await pool.query(
    "SELECT value FROM workspace_settings WHERE key = 'plane'",
  )
  const cfg = wsRes.rows[0]?.value ?? {}
  if (cfg.api_token) {
    return { token: cfg.api_token, baseUrl: cfg.base_url ?? 'https://plane.on-nex.us' }
  }

  throw Object.assign(new Error('Plane token not configured'), { statusCode: 401 })
}

async function planeGet<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'X-Api-Key': token, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw Object.assign(new Error(`Plane API error ${res.status}: ${text}`), { statusCode: res.status })
  }
  return res.json() as Promise<T>
}

export async function planeRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/plane/projects — list workspace projects for link UI
  fastify.get('/api/v1/plane/projects', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const { token, baseUrl } = await resolvePlane(pool, request.user.sub)

        // Fetch workspaces first to get slug
        const wsData = await planeGet<any>(baseUrl, token, '/api/v1/workspaces/')
        const workspaces: any[] = wsData.results ?? wsData ?? []
        if (!workspaces.length) return reply.send([])

        const results: any[] = []
        for (const ws of workspaces) {
          const projData = await planeGet<any>(baseUrl, token, `/api/v1/workspaces/${ws.slug}/projects/`)
          const projects: any[] = projData.results ?? projData ?? []
          for (const p of projects) {
            results.push({
              id: p.id,
              name: p.name,
              identifier: p.identifier,
              workspace_slug: ws.slug,
            })
          }
        }
        return reply.send(results)
      } catch (err: any) {
        return reply.code(err.statusCode ?? 500).send({ error: err.message })
      }
    },
  })

  // GET /api/v1/projects/:id/plane/issues — live issues for a linked AI-OS project
  fastify.get('/api/v1/projects/:id/plane/issues', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const { id } = request.params as { id: string }
        const tenantId: string = request.user?.tenant_id ?? request.user?.tenantId ?? ''

        const projRes = await pool.query(
          'SELECT plane_project_id, plane_workspace_slug FROM projects WHERE id = $1 AND tenant_id = $2',
          [id, tenantId],
        )
        const proj = projRes.rows[0]
        if (!proj?.plane_project_id) {
          return reply.code(404).send({ error: 'Project not linked to Plane' })
        }

        const { token, baseUrl } = await resolvePlane(pool, request.user.sub)

        const issueData = await planeGet<any>(
          baseUrl, token,
          `/api/v1/workspaces/${proj.plane_workspace_slug}/projects/${proj.plane_project_id}/issues/?per_page=100`,
        )
        const raw: any[] = issueData.results ?? issueData ?? []

        const issues = raw.map((i: any) => ({
          id: i.id,
          sequence_id: i.sequence_id,
          name: i.name,
          state: i.state_detail
            ? { name: i.state_detail.name, group: i.state_detail.group }
            : { name: i.state ?? 'Unknown', group: 'unstarted' },
          priority: i.priority ?? 'none',
          assignees: i.assignees ?? [],
          plane_url: `${baseUrl}/${proj.plane_workspace_slug}/projects/${proj.plane_project_id}/issues/${i.id}/`,
        }))

        return reply.send(issues)
      } catch (err: any) {
        return reply.code(err.statusCode ?? 500).send({ error: err.message })
      }
    },
  })
}
