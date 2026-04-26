// apps/api/src/routes/plane.ts
// Plane API proxy — resolves per-user or workspace token, never exposes credentials to browser
import type { FastifyInstance } from 'fastify'

async function resolvePlane(pool: any, userId: string): Promise<{ token: string; baseUrl: string; cfg: any }> {
  // 1. Per-user token
  const userRes = await pool.query(
    'SELECT plane_api_token FROM user_profiles WHERE user_id = $1',
    [userId],
  )
  const cfgRes = await pool.query("SELECT value FROM workspace_settings WHERE key = 'plane'")
  const cfg = cfgRes.rows[0]?.value ?? {}
  const baseUrl: string = cfg.base_url ?? 'https://plane.on-nex.us'

  if (userRes.rows[0]?.plane_api_token) {
    return { token: userRes.rows[0].plane_api_token, baseUrl, cfg }
  }

  // 2. Workspace service token fallback
  if (cfg.api_token) {
    return { token: cfg.api_token, baseUrl, cfg }
  }

  throw Object.assign(new Error('Plane token not configured'), { statusCode: 401 })
}

async function planeFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'X-Api-Key': token,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw Object.assign(new Error(`Plane API error ${res.status}: ${text}`), { statusCode: res.status })
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

function sanitizePlaneName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() || 'Project'
}

function makeIdentifier(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return clean.slice(0, 6) || 'PROJ'
}

export async function planeRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/plane/projects — list workspace projects for link UI
  fastify.get('/api/v1/plane/projects', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const { token, baseUrl, cfg } = await resolvePlane(pool, request.user.sub)
        const workspaceSlug: string | null = cfg.workspace_slug ?? null
        if (!workspaceSlug) {
          return reply.code(400).send({ error: 'Plane workspace slug not configured — set it in Settings → Integrations' })
        }
        const projData = await planeFetch<any>(baseUrl, token, `/api/v1/workspaces/${workspaceSlug}/projects/`)
        const projects: any[] = projData.results ?? projData ?? []
        return reply.send(projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          identifier: p.identifier,
          workspace_slug: workspaceSlug,
        })))
      } catch (err: any) {
        return reply.code(err.statusCode ?? 500).send({ error: err.message })
      }
    },
  })

  // POST /api/v1/plane/projects — create a new Plane project, auto-add members, link to AIOS project
  fastify.post('/api/v1/plane/projects', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      try {
        const { aios_project_id, name } = (request.body ?? {}) as { aios_project_id?: string; name?: string }
        if (!aios_project_id || !name) {
          return reply.code(400).send({ error: 'aios_project_id and name are required' })
        }
        const tenantId: string = request.user?.tenant_id ?? request.user?.tenantId ?? ''

        const { token, baseUrl, cfg } = await resolvePlane(pool, request.user.sub)

        const workspaceSlug: string | null = cfg.workspace_slug ?? null
        if (!workspaceSlug) return reply.code(400).send({ error: 'Plane workspace slug not configured — set it in Settings → Integrations' })

        // Sanitize name + generate identifier
        const planeName = sanitizePlaneName(name)
        const baseId = makeIdentifier(planeName)

        // Create project — retry with random suffix on identifier collision
        let created: any
        for (let attempt = 0; attempt < 3; attempt++) {
          const identifier = attempt === 0 ? baseId : `${baseId.slice(0, 4)}${Math.floor(Math.random() * 90 + 10)}`
          try {
            created = await planeFetch<any>(baseUrl, token, `/api/v1/workspaces/${workspaceSlug}/projects/`, {
              method: 'POST',
              body: JSON.stringify({ name: planeName, identifier, network: 2 }),
            })
            break
          } catch (err: any) {
            if (attempt === 2) throw err
            // Swallow collision and retry
          }
        }

        const planeProjectId: string = created.id

        // Fetch workspace members to resolve auto-member emails → IDs
        const membersData = await planeFetch<any>(baseUrl, token, `/api/v1/workspaces/${workspaceSlug}/members/`)
        const wsMembers: any[] = membersData.results ?? membersData ?? []
        const emailToId = new Map(wsMembers.map((m: any) => [m.email, m.id]))

        // Auto-members from settings, or fall back to defaults
        const autoMembers: Array<{ email: string; role: number }> = cfg.auto_members ?? [
          { email: 'hugh@on-nex.com', role: 20 },
        ]

        // Creator is already added; add remaining auto-members, skip errors
        for (const am of autoMembers) {
          const memberId = emailToId.get(am.email)
          if (!memberId) continue // user not in this workspace
          try {
            await planeFetch(baseUrl, token, `/api/v1/workspaces/${workspaceSlug}/projects/${planeProjectId}/members/`, {
              method: 'POST',
              body: JSON.stringify({ member: memberId, role: am.role }),
            })
          } catch {
            // Ignore — member may already be present (creator)
          }
        }

        // Update AIOS project to link it
        await pool.query(
          'UPDATE projects SET plane_project_id = $1, plane_workspace_slug = $2, plane_project_name = $3 WHERE id = $4 AND tenant_id = $5',
          [planeProjectId, workspaceSlug, planeName, aios_project_id, tenantId],
        )

        return reply.code(201).send({
          id: planeProjectId,
          name: planeName,
          identifier: created.identifier,
          workspace_slug: workspaceSlug,
          plane_url: `${baseUrl}/${workspaceSlug}/projects/${planeProjectId}/issues/`,
        })
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

        const issueData = await planeFetch<any>(
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
