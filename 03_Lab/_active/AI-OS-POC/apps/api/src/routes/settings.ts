// apps/api/src/routes/settings.ts
// Phase 12: Settings API — workspace profile, SMTP config, n8n webhooks, integration health
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/** Read a JSONB value by key from workspace_settings. Returns null if absent. */
async function getSettingValue(pool: any, key: string): Promise<any | null> {
  const result = await pool.query(
    'SELECT value FROM workspace_settings WHERE key = $1',
    [key],
  )
  if (result.rows.length === 0) return null
  return result.rows[0].value
}

/** Upsert a JSONB value by key into workspace_settings. */
async function upsertSettingValue(pool: any, key: string, value: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO workspace_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  )
}

// ---------------------------------------------------------------------------
// Workspace defaults
// ---------------------------------------------------------------------------

const WORKSPACE_DEFAULTS = {
  name: 'Agency AI-OS',
  logo_url: null as string | null,
  timezone: 'America/Los_Angeles',
  default_currency: 'USD',
}

// ---------------------------------------------------------------------------
// fireN8nWebhook — exported named helper (used by deals.ts, invoices.ts, tasks.ts)
// Non-fatal: never throws, never blocks caller
// ---------------------------------------------------------------------------

export async function fireN8nWebhook(
  pool: any,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const config = await getSettingValue(pool, 'n8n')
    if (!config || !config.webhook_url) return
    const enabledEvents: string[] = config.enabled_events ?? []
    if (!enabledEvents.includes(event)) return

    await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...payload }),
    })
  } catch {
    // Webhook failure is non-fatal — never propagates to caller
  }
}

// ---------------------------------------------------------------------------
// settingsRoutes plugin
// ---------------------------------------------------------------------------

export async function settingsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // --- GET /api/v1/settings/workspace ---
  fastify.get('/api/v1/settings/workspace', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (_request: any, reply: any) => {
      const value = await getSettingValue(pool, 'workspace')
      return reply.code(200).send(value ?? WORKSPACE_DEFAULTS)
    },
  })

  // --- PUT /api/v1/settings/workspace ---
  fastify.put('/api/v1/settings/workspace', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const { name, logo_url, timezone, default_currency } = request.body as any

      // Zod-style validation (inline — no external dep needed)
      if (name !== undefined) {
        if (typeof name !== 'string' || name.length > 100) {
          return reply.code(400).send({ error: 'name must be a string of max 100 characters' })
        }
      }
      if (timezone !== undefined && typeof timezone !== 'string') {
        return reply.code(400).send({ error: 'timezone must be a string' })
      }

      // Merge with existing
      const existing = (await getSettingValue(pool, 'workspace')) ?? WORKSPACE_DEFAULTS
      const updated = {
        ...existing,
        ...(name !== undefined && { name }),
        ...(logo_url !== undefined && { logo_url }),
        ...(timezone !== undefined && { timezone }),
        ...(default_currency !== undefined && { default_currency }),
      }

      await upsertSettingValue(pool, 'workspace', updated)
      return reply.code(200).send(updated)
    },
  })

  // --- GET /api/v1/settings/smtp ---
  fastify.get('/api/v1/settings/smtp', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (_request: any, reply: any) => {
      const value = await getSettingValue(pool, 'smtp')
      if (!value) {
        return reply.code(200).send({ host: null, port: null, user: null, from_address: null, has_password: false })
      }
      // Normalize legacy field names (from → from_address, pass → password)
      return reply.code(200).send({
        host: value.host ?? null,
        port: value.port ?? null,
        user: value.user ?? null,
        from_address: value.from_address ?? value.from ?? null,
        has_password: !!(value.password || value.pass),
      })
    },
  })

  // --- PUT /api/v1/settings/smtp ---
  fastify.put('/api/v1/settings/smtp', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const { host, port, user, from_address, password } = request.body as any

      // Merge with existing — migrate legacy keys (from→from_address, pass→password)
      const raw = (await getSettingValue(pool, 'smtp')) ?? {}
      const base: Record<string, unknown> = {
        host: raw.host,
        port: raw.port,
        user: raw.user,
        from_address: raw.from_address ?? raw.from,
        password: raw.password ?? raw.pass,
        // preserve extra keys (from_name, secure, etc.)
        ...Object.fromEntries(
          Object.entries(raw).filter(([k]) => !['host','port','user','from_address','from','password','pass'].includes(k))
        ),
      }
      const updated: Record<string, unknown> = {
        ...base,
        ...(host !== undefined && { host }),
        ...(port !== undefined && { port }),
        ...(user !== undefined && { user }),
        ...(from_address !== undefined && { from_address }),
        ...(password !== undefined && { password }),
      }

      await upsertSettingValue(pool, 'smtp', updated)

      return reply.code(200).send({
        host: updated.host ?? null,
        port: updated.port ?? null,
        user: updated.user ?? null,
        from_address: (updated.from_address as string) ?? null,
        has_password: !!(updated.password),
      })
    },
  })

  // --- POST /api/v1/settings/smtp/test-send ---
  fastify.post('/api/v1/settings/smtp/test-send', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const { to } = request.body as any

      const config = await getSettingValue(pool, 'smtp')
      if (!config || !config.host) {
        return reply.code(200).send({ success: false, error: 'SMTP not configured — save settings first.' })
      }

      // Normalize legacy field names
      const smtpPass = config.password ?? config.pass
      const smtpFrom = config.from_address ?? config.from ?? config.user

      try {
        const nodemailer = await import('nodemailer')
        const transporter = nodemailer.default.createTransport({
          host: config.host,
          port: parseInt(String(config.port ?? '587'), 10),
          secure: config.secure ?? false,
          auth: config.user && smtpPass ? { user: config.user, pass: smtpPass } : undefined,
        })

        await transporter.sendMail({
          from: smtpFrom,
          to: to ?? config.user,
          subject: 'Agency AI-OS — SMTP Test',
          text: 'This is a test email from Agency AI-OS. Your SMTP configuration is working correctly.',
        })

        return reply.code(200).send({ success: true })
      } catch (err: any) {
        return reply.code(200).send({ success: false, error: err?.message ?? 'SMTP error' })
      }
    },
  })

  // --- GET /api/v1/settings/n8n ---
  fastify.get('/api/v1/settings/n8n', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (_request: any, reply: any) => {
      const value = await getSettingValue(pool, 'n8n')
      return reply.code(200).send(value ?? { webhook_url: null, enabled_events: [] })
    },
  })

  // --- PUT /api/v1/settings/n8n ---
  fastify.put('/api/v1/settings/n8n', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const { webhook_url, enabled_events } = request.body as any

      // Validate webhook_url if provided
      if (webhook_url !== null && webhook_url !== undefined) {
        try {
          new URL(webhook_url)
        } catch {
          return reply.code(400).send({ error: 'webhook_url must be a valid URL' })
        }
      }

      // Validate enabled_events
      if (enabled_events !== undefined && !Array.isArray(enabled_events)) {
        return reply.code(400).send({ error: 'enabled_events must be an array' })
      }

      const existing = (await getSettingValue(pool, 'n8n')) ?? { webhook_url: null, enabled_events: [] }
      const updated = {
        ...existing,
        ...(webhook_url !== undefined && { webhook_url }),
        ...(enabled_events !== undefined && { enabled_events }),
      }

      await upsertSettingValue(pool, 'n8n', updated)
      return reply.code(200).send(updated)
    },
  })

  // --- GET /api/v1/settings/integrations ---
  fastify.get('/api/v1/settings/integrations', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (_request: any, reply: any) => {
      // Use Promise.allSettled — one failing service must not throw the whole endpoint
      const checks = await Promise.allSettled([
        // Authentik — use the unauthenticated health/ready endpoint (no token needed)
        fetch('http://authentik-server:9000/-/health/ready/', {
          signal: AbortSignal.timeout(5000),
        }).then(r => ({ service: 'Authentik', ok: r.ok })),

        // Nextcloud
        fetch('http://nextcloud-app:80/status.php', {
          signal: AbortSignal.timeout(5000),
        }).then(r => ({ service: 'Nextcloud', ok: r.ok })),

        // Paperless-ngx
        fetch('http://paperless-web:8000/api/', {
          signal: AbortSignal.timeout(5000),
        }).then(r => ({ service: 'Paperless-ngx', ok: r.ok })),

        // Temporal — check env var presence as proxy for reachability
        Promise.resolve({
          service: 'Temporal',
          ok: !!(process.env.TEMPORAL_ADDRESS),
        }),
      ])

      const now = new Date().toISOString()
      const result = checks.map((check, _i) => {
        if (check.status === 'fulfilled') {
          return {
            service: check.value.service,
            status: check.value.ok ? 'healthy' : 'degraded',
            last_checked: now,
          }
        } else {
          // Rejected — connection error
          const services = ['Authentik', 'Nextcloud', 'Paperless-ngx', 'Temporal']
          return {
            service: services[_i] ?? `service-${_i}`,
            status: 'degraded',
            last_checked: now,
          }
        }
      })

      return reply.code(200).send(result)
    },
  })

  // GET /api/v1/settings/plane — workspace Plane base URL + service token (redacted)
  fastify.get('/api/v1/settings/plane', {
    preHandler: [(fastify as any).authenticate, requireRole(['owner', 'ops_manager'])],
    handler: async (_request: any, reply: any) => {
      const cfg = await getSettingValue(pool, 'plane') ?? {}
      return reply.send({
        base_url: cfg.base_url ?? 'https://plane.on-nex.us',
        workspace_slug: cfg.workspace_slug ?? null,
        api_token: cfg.api_token ? '********' : null,
      })
    },
  })

  // PUT /api/v1/settings/plane — save workspace Plane base URL + service token + workspace slug
  fastify.put('/api/v1/settings/plane', {
    preHandler: [(fastify as any).authenticate, requireRole(['owner', 'ops_manager'])],
    handler: async (request: any, reply: any) => {
      const { base_url, api_token, workspace_slug } = request.body ?? {}
      const existing = await getSettingValue(pool, 'plane') ?? {}
      await upsertSettingValue(pool, 'plane', {
        base_url: base_url ?? existing.base_url ?? 'https://plane.on-nex.us',
        workspace_slug: workspace_slug ?? existing.workspace_slug ?? null,
        api_token: api_token ?? existing.api_token ?? null,
      })
      return reply.send({ ok: true })
    },
  })
}
