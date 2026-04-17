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
        return reply.code(200).send({
          host: null,
          port: null,
          user: null,
          from_address: null,
          has_password: false,
        })
      }
      // Redact password — return boolean has_password instead
      const { password: _password, ...safe } = value
      return reply.code(200).send({ ...safe, has_password: !!value.password })
    },
  })

  // --- PUT /api/v1/settings/smtp ---
  fastify.put('/api/v1/settings/smtp', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const { host, port, user, from_address, password } = request.body as any

      // Merge with existing (allow partial update)
      const existing = (await getSettingValue(pool, 'smtp')) ?? {}
      const updated = {
        ...existing,
        ...(host !== undefined && { host }),
        ...(port !== undefined && { port }),
        ...(user !== undefined && { user }),
        ...(from_address !== undefined && { from_address }),
        ...(password !== undefined && { password }),
      }

      await upsertSettingValue(pool, 'smtp', updated)

      // Return sanitized (no password)
      const { password: _pw, ...safe } = updated
      return reply.code(200).send({ ...safe, has_password: !!updated.password })
    },
  })

  // --- POST /api/v1/settings/smtp/test-send ---
  fastify.post('/api/v1/settings/smtp/test-send', {
    preHandler: [(fastify as any).authenticate, requireRole(['admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const { to } = request.body as any

      const config = await getSettingValue(pool, 'smtp')
      if (!config || !config.host) {
        return reply.code(400).send({ error: 'SMTP configuration not found. Configure SMTP settings first.' })
      }

      try {
        const nodemailer = await import('nodemailer')
        const transporter = nodemailer.default.createTransport({
          host: config.host,
          port: parseInt(String(config.port ?? '587'), 10),
          auth: config.user ? { user: config.user, pass: config.password } : undefined,
        })

        await transporter.sendMail({
          from: config.from_address ?? config.user,
          to: to ?? config.user,
          subject: 'Agency AI-OS — SMTP Test',
          text: 'This is a test email from Agency AI-OS settings. Your SMTP configuration is working correctly.',
        })

        return reply.code(200).send({ success: true })
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err?.message ?? 'Unknown SMTP error' })
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
}
