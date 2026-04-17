// apps/api/src/routes/cron.ts
// Phase 10: Overdue invoice cron — notification INSERT + nodemailer email
// Protected by X-Cron-Secret header (CRON_SECRET env var)
import type { FastifyInstance } from 'fastify'

export async function cronRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // POST /api/v1/cron/check-overdue — scan overdue invoices, insert notifications, send emails
  // Protected by shared secret header — NOT an authenticated user endpoint
  fastify.post('/api/v1/cron/check-overdue', {
    handler: async (request: any, reply: any) => {
      // Validate shared secret to prevent abuse
      const cronSecret = process.env.CRON_SECRET
      const incomingSecret = request.headers['x-cron-secret']

      if (!cronSecret || incomingSecret !== cronSecret) {
        return reply.code(401).send({ error: 'Unauthorized — invalid or missing X-Cron-Secret' })
      }

      // Find all overdue unpaid invoices (status IN ('sent','draft') AND due_date < NOW())
      const overdueResult = await pool.query(
        `SELECT i.id, i.tenant_id, i.client_id, i.due_date, i.status
         FROM invoices i
         WHERE i.status IN ('sent', 'draft')
           AND i.due_date < NOW()
         ORDER BY i.due_date ASC`,
      )

      const overdueInvoices = overdueResult.rows
      let processed = 0

      for (const invoice of overdueInvoices) {
        // Find finance/admin users for this tenant to notify
        // Since we don't have a users table (auth is in Authentik), use FINANCE_EMAIL env var fallback
        // In production, this would query the users/groups from Authentik or a local users cache
        const financeEmail = process.env.FINANCE_EMAIL ?? process.env.SMTP_USER

        // Insert overdue notification — use nil UUID as tenant/user sentinel so the
        // UUID NOT NULL columns accept the value and the notifications GET can surface
        // system-tagged rows for all authenticated users
        const NIL_UUID = '00000000-0000-0000-0000-000000000000'
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const notifTenantId = UUID_RE.test(invoice.tenant_id) ? invoice.tenant_id : NIL_UUID
        try {
          await pool.query(
            `INSERT INTO notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
             VALUES ($1, $2, 'invoice_overdue', 'Invoice Overdue', $3, 'invoice', $4)
             ON CONFLICT DO NOTHING`,
            [
              notifTenantId,
              NIL_UUID, // nil UUID sentinel — notifications GET also returns these for all authed users
              `Invoice due ${invoice.due_date} is overdue`,
              invoice.id,
            ],
          )
        } catch {
          // notification table may not have a unique constraint on entity_id — log and continue
        }

        // Send email notification via nodemailer
        if (financeEmail) {
          try {
            const nodemailer = await import('nodemailer')
            const transporter = nodemailer.default.createTransport({
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT ?? '587'),
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            })

            await transporter.sendMail({
              from: process.env.SMTP_USER,
              to: financeEmail,
              subject: `[AI-OS] Overdue Invoice Alert`,
              text: `Invoice ID ${invoice.id} (tenant: ${invoice.tenant_id}) was due on ${invoice.due_date} and has not been paid. Status: ${invoice.status}`,
            })
          } catch {
            // SMTP failure should not block processing other invoices
            fastify.log?.warn({ invoiceId: invoice.id }, 'Failed to send overdue email notification')
          }
        }

        processed++
      }

      return reply.code(200).send({ processed, total_overdue: overdueInvoices.length })
    },
  })
}
