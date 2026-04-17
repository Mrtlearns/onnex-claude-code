// apps/api/src/routes/invoices.ts
// Phase 9: Invoices CRUD + finance-role gate + PDF generation + SMTP send + T&M line items
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

// PDF generation using pdf-lib (no Chromium / no puppeteer)
async function generateInvoicePdf(invoice: any, lineItems: any[]): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Header
  page.drawText('INVOICE', { x: 50, y: 792, size: 24, font: boldFont, color: rgb(0, 0, 0) })
  page.drawText(`Invoice #${String(invoice.id).slice(0, 8).toUpperCase()}`, { x: 50, y: 765, size: 12, font })
  page.drawText(`Due: ${invoice.due_date ?? 'On Receipt'}`, { x: 50, y: 748, size: 12, font })

  // Line items
  let y = 700
  for (const item of lineItems) {
    const total = (Number(item.qty) * Number(item.rate)).toFixed(2)
    page.drawText(`${item.description}`, { x: 50, y, size: 10, font })
    page.drawText(`${item.qty} x $${item.rate} = $${total}`, { x: 350, y, size: 10, font })
    y -= 20
  }

  // Subtotal, tax, total
  const subtotal = lineItems.reduce((s, i) => s + Number(i.qty) * Number(i.rate), 0)
  const tax = subtotal * (Number(invoice.tax_pct) / 100)
  page.drawText(`Subtotal: $${subtotal.toFixed(2)}`, { x: 350, y: y - 20, size: 11, font })
  page.drawText(`Tax (${invoice.tax_pct}%): $${tax.toFixed(2)}`, { x: 350, y: y - 36, size: 11, font })
  page.drawText(`TOTAL: $${(subtotal + tax).toFixed(2)}`, { x: 350, y: y - 56, size: 13, font: boldFont })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// SMTP email via nodemailer
async function sendInvoiceEmail(to: string, subject: string, pdfBuffer: Buffer): Promise<void> {
  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text: 'Please find your invoice attached.',
    attachments: [
      {
        filename: `invoice-${Date.now()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

export async function invoicesRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/invoices — tenant list, supports ?status=, ?client_id= filters
  fastify.get('/api/v1/invoices', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { status, client_id } = request.query as Record<string, string>

      let query = 'SELECT * FROM invoices WHERE tenant_id = $1'
      const params: unknown[] = [tenantId]
      let idx = 2

      if (status) {
        query += ` AND status = $${idx++}`
        params.push(status)
      }
      if (client_id) {
        query += ` AND client_id = $${idx++}`
        params.push(client_id)
      }

      query += ' ORDER BY created_at DESC'
      const result = await pool.query(query, params)
      return reply.code(200).send({ invoices: result.rows })
    },
  })

  // POST /api/v1/invoices — create with optional line_items array; finance/admin/super_admin only
  fastify.post('/api/v1/invoices', {
    preHandler: [(fastify as any).authenticate, requireRole(['finance', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { client_id, deal_id, due_date, tax_pct = 0, notes, line_items } = request.body as any

      const result = await pool.query(
        `INSERT INTO invoices (tenant_id, client_id, deal_id, due_date, tax_pct, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, client_id, deal_id ?? null, due_date ?? null, tax_pct, notes ?? null],
      )
      const invoice = result.rows[0]

      // Insert line items if provided
      if (Array.isArray(line_items) && line_items.length > 0) {
        for (const item of line_items) {
          await pool.query(
            `INSERT INTO invoice_line_items (invoice_id, description, qty, rate, time_entry_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [invoice.id, item.description, item.qty ?? 1, item.rate ?? 0, item.time_entry_id ?? null],
          )
        }
      }

      return reply.code(201).send({ invoice })
    },
  })

  // GET /api/v1/invoices/:id — invoice detail
  fastify.get('/api/v1/invoices/:id', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      const result = await pool.query(
        'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }

      const lineItems = await pool.query(
        'SELECT * FROM invoice_line_items WHERE invoice_id = $1',
        [id],
      )

      return reply.code(200).send({ invoice: result.rows[0], lineItems: lineItems.rows })
    },
  })

  // PATCH /api/v1/invoices/:id/status — update status {status, paid_at?}
  fastify.patch('/api/v1/invoices/:id/status', {
    preHandler: [(fastify as any).authenticate, requireRole(['finance', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { status, paid_at } = request.body as any

      let query = 'UPDATE invoices SET status = $1'
      const params: unknown[] = [status]
      let idx = 2

      if (paid_at) {
        query += `, paid_at = $${idx++}`
        params.push(paid_at)
      }

      params.push(id, tenantId)
      query += ` WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`

      const result = await pool.query(query, params)
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }
      return reply.code(200).send({ invoice: result.rows[0] })
    },
  })

  // GET /api/v1/invoices/:id/time-entries — unbilled T&M entries for project
  // Returns both unbilled and already-linked entries so UI can show current selection
  fastify.get('/api/v1/invoices/:id/time-entries', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { project_id } = request.query as Record<string, string>

      if (!project_id) {
        return reply.code(400).send({ error: 'project_id query parameter is required' })
      }

      // Verify invoice exists and belongs to this tenant
      const invoiceResult = await pool.query(
        'SELECT id FROM invoices WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (invoiceResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }

      // Return time entries for the project — unbilled OR already linked to this invoice
      const result = await pool.query(
        `SELECT te.* FROM time_entries te
         LEFT JOIN invoice_line_items ili ON ili.time_entry_id = te.id
         WHERE te.project_id = $1
           AND te.tenant_id = $2
           AND te.billable = true
           AND (ili.invoice_id IS NULL OR ili.invoice_id = $3)
         ORDER BY te.date DESC`,
        [project_id, tenantId, id],
      )

      return reply.code(200).send({ timeEntries: result.rows })
    },
  })

  // POST /api/v1/invoices/:id/line-items — add line item
  fastify.post('/api/v1/invoices/:id/line-items', {
    preHandler: [(fastify as any).authenticate, requireRole(['finance', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any
      const { description, qty = 1, rate = 0, time_entry_id } = request.body as any

      // Verify invoice belongs to tenant
      const invoiceResult = await pool.query(
        'SELECT id FROM invoices WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      )
      if (invoiceResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }

      const result = await pool.query(
        `INSERT INTO invoice_line_items (invoice_id, description, qty, rate, time_entry_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, description, qty, rate, time_entry_id ?? null],
      )

      return reply.code(201).send({ lineItem: result.rows[0] })
    },
  })

  // POST /api/v1/invoices/:id/send — generate PDF and send via SMTP
  fastify.post('/api/v1/invoices/:id/send', {
    preHandler: [(fastify as any).authenticate, requireRole(['finance', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { id } = request.params as any

      // Fetch invoice with client email
      const invoiceResult = await pool.query(
        `SELECT i.*, c.name AS client_name
         FROM invoices i
         LEFT JOIN clients c ON c.id = i.client_id
         WHERE i.id = $1 AND i.tenant_id = $2`,
        [id, tenantId],
      )
      if (invoiceResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }
      const invoice = invoiceResult.rows[0]

      // Get client primary email from contacts
      const contactResult = await pool.query(
        `SELECT email FROM contacts WHERE client_id = $1 AND email IS NOT NULL LIMIT 1`,
        [invoice.client_id],
      )
      const clientEmail = contactResult.rows[0]?.email ?? process.env.SMTP_USER

      // Fetch line items
      const lineItemsResult = await pool.query(
        'SELECT * FROM invoice_line_items WHERE invoice_id = $1',
        [id],
      )
      const lineItems = lineItemsResult.rows

      // Generate PDF
      const pdfBuffer = await generateInvoicePdf(invoice, lineItems)

      // Send email
      await sendInvoiceEmail(
        clientEmail,
        `Invoice #${String(id).slice(0, 8).toUpperCase()} from Agency`,
        pdfBuffer,
      )

      // Update status to sent
      await pool.query(
        `UPDATE invoices SET status = 'sent', sent_at = now() WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      )

      return reply.code(200).send({ sent: true })
    },
  })
}
