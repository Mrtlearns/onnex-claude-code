// apps/api/src/routes/reports.ts
// Phase 11: SQL aggregation report endpoints — utilization, revenue, profitability, client-activity
// Each endpoint supports ?period=this_week|this_month|last_month|this_quarter|this_year|custom
// and ?format=csv for CSV download.
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

// ---------------------------------------------------------------------------
// Period range helper
// ---------------------------------------------------------------------------
export function getPeriodRange(
  period: string,
  start?: string,
  end?: string,
): { startDate: Date; endDate: Date } {
  const now = new Date()

  if (period === 'custom') {
    if (!start || !end) {
      throw new Error('custom period requires start and end ISO strings')
    }
    return { startDate: new Date(start), endDate: new Date(end) }
  }

  // Helper: start of a day in UTC
  const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed
  const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon …
  const todayDate = now.getUTCDate()

  if (period === 'this_week') {
    // Monday of this week
    const daysFromMon = (dayOfWeek + 6) % 7
    const monday = utcDate(year, month, todayDate - daysFromMon)
    const sunday = new Date(monday.getTime() + 6 * 86_400_000)
    sunday.setUTCHours(23, 59, 59, 999)
    return { startDate: monday, endDate: sunday }
  }

  if (period === 'this_month') {
    const startDate = utcDate(year, month, 1)
    const endDate = utcDate(year, month + 1, 0) // last day of month
    endDate.setUTCHours(23, 59, 59, 999)
    return { startDate, endDate }
  }

  if (period === 'last_month') {
    const startDate = utcDate(year, month - 1, 1)
    const endDate = utcDate(year, month, 0)
    endDate.setUTCHours(23, 59, 59, 999)
    return { startDate, endDate }
  }

  if (period === 'this_quarter') {
    const quarterStart = Math.floor(month / 3) * 3 // 0, 3, 6, or 9
    const startDate = utcDate(year, quarterStart, 1)
    const endDate = utcDate(year, quarterStart + 3, 0)
    endDate.setUTCHours(23, 59, 59, 999)
    return { startDate, endDate }
  }

  if (period === 'this_year') {
    const startDate = utcDate(year, 0, 1)
    const endDate = utcDate(year, 12, 0)
    endDate.setUTCHours(23, 59, 59, 999)
    return { startDate, endDate }
  }

  // Default: this_month
  const startDate = utcDate(year, month, 1)
  const endDate = utcDate(year, month + 1, 0)
  endDate.setUTCHours(23, 59, 59, 999)
  return { startDate, endDate }
}

// ---------------------------------------------------------------------------
// CSV helper
// ---------------------------------------------------------------------------
export function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerRow = headers.join(',')
  const dataRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        // Wrap in quotes if contains comma, newline or quote
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(','),
  )
  return [headerRow, ...dataRows].join('\n')
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export async function reportsRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/reports/utilization
  // manager, admin, super_admin
  fastify.get('/api/v1/reports/utilization', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['manager', 'admin', 'super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { period = 'this_month', start, end } = request.query as Record<string, string>

      const { startDate, endDate } = getPeriodRange(period, start, end)

      // Weeks in range (at least 1)
      const msPerWeek = 7 * 24 * 60 * 60 * 1000
      const weeksInRange = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerWeek))
      const capacityMinutes = weeksInRange * 40 * 60

      const result = await pool.query(
        `SELECT
           te.user_id,
           te.user_id::text AS user_name,
           COALESCE(SUM(te.duration_minutes), 0) AS total_minutes
         FROM time_entries te
         WHERE te.tenant_id = $1
           AND te.date >= $2
           AND te.date <= $3
         GROUP BY te.user_id
         ORDER BY total_minutes DESC`,
        [tenantId, startDate, endDate],
      )

      const rows = result.rows.map((r: any) => ({
        user_id: r.user_id,
        user_name: r.user_name ?? r.user_id,
        total_minutes: parseInt(r.total_minutes, 10),
        capacity_minutes: capacityMinutes,
        utilization_pct: Math.round((parseInt(r.total_minutes, 10) / capacityMinutes) * 100),
      }))

      if (request.query.format === 'csv') {
        const csv = rowsToCsv(
          ['user_id', 'user_name', 'total_minutes', 'capacity_minutes', 'utilization_pct'],
          rows,
        )
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', 'attachment; filename="utilization-report.csv"')
          .send(csv)
      }

      return reply.code(200).send(rows)
    },
  })

  // GET /api/v1/reports/revenue
  // finance, admin, super_admin
  fastify.get('/api/v1/reports/revenue', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['finance', 'admin', 'super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { period = 'this_month', start, end } = request.query as Record<string, string>

      const { startDate, endDate } = getPeriodRange(period, start, end)

      const result = await pool.query(
        `SELECT
           c.id AS client_id,
           c.name AS client_name,
           COALESCE(SUM(
             CASE WHEN i.status IN ('sent','paid') THEN
               (SELECT COALESCE(SUM(qty * rate), 0) FROM invoice_line_items WHERE invoice_id = i.id)
             ELSE 0 END
           ), 0) AS invoiced_total,
           COALESCE(SUM(
             CASE WHEN i.status = 'paid' AND i.paid_at BETWEEN $2 AND $3 THEN
               (SELECT COALESCE(SUM(qty * rate), 0) FROM invoice_line_items WHERE invoice_id = i.id)
             ELSE 0 END
           ), 0) AS received_total
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         WHERE i.tenant_id = $1
           AND i.created_at BETWEEN $2 AND $3
         GROUP BY c.id, c.name
         ORDER BY invoiced_total DESC`,
        [tenantId, startDate, endDate],
      )

      const rows = result.rows.map((r: any) => ({
        client_id: r.client_id,
        client_name: r.client_name,
        invoiced_total: parseFloat(r.invoiced_total),
        received_total: parseFloat(r.received_total),
      }))

      if (request.query.format === 'csv') {
        const csv = rowsToCsv(
          ['client_id', 'client_name', 'invoiced_total', 'received_total'],
          rows,
        )
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', 'attachment; filename="revenue-report.csv"')
          .send(csv)
      }

      return reply.code(200).send(rows)
    },
  })

  // GET /api/v1/reports/profitability
  // manager, admin, super_admin
  fastify.get('/api/v1/reports/profitability', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['manager', 'admin', 'super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { period = 'this_month', start, end } = request.query as Record<string, string>

      const { startDate, endDate } = getPeriodRange(period, start, end)

      const result = await pool.query(
        `SELECT
           p.id AS project_id,
           p.name AS project_name,
           COALESCE(SUM(
             (SELECT COALESCE(SUM(qty * rate), 0) FROM invoice_line_items WHERE invoice_id = i.id)
           ), 0) AS revenue,
           0 AS cost
         FROM projects p
         LEFT JOIN invoices i ON i.client_id = p.client_id
           AND i.tenant_id = p.tenant_id
           AND i.created_at BETWEEN $2 AND $3
           AND i.status IN ('sent','paid')
         WHERE p.tenant_id = $1
         GROUP BY p.id, p.name
         ORDER BY revenue DESC`,
        [tenantId, startDate, endDate],
      )

      const rows = result.rows.map((r: any) => {
        const revenue = parseFloat(r.revenue)
        const cost = parseFloat(r.cost)
        const margin = revenue - cost
        return {
          project_id: r.project_id,
          project_name: r.project_name,
          revenue,
          cost,
          margin,
          margin_pct: revenue > 0 ? Math.round((margin / revenue) * 100) : 0,
        }
      })

      if (request.query.format === 'csv') {
        const csv = rowsToCsv(
          ['project_id', 'project_name', 'revenue', 'cost', 'margin', 'margin_pct'],
          rows,
        )
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', 'attachment; filename="profitability-report.csv"')
          .send(csv)
      }

      return reply.code(200).send(rows)
    },
  })

  // GET /api/v1/reports/client-activity
  // manager, admin, super_admin
  fastify.get('/api/v1/reports/client-activity', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['manager', 'admin', 'super_admin']),
    ],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const { period = 'this_month', start, end } = request.query as Record<string, string>

      const { startDate, endDate } = getPeriodRange(period, start, end)

      const result = await pool.query(
        `SELECT
           c.id AS client_id,
           c.name AS client_name,
           COUNT(ae.id) AS event_count,
           MAX(ae.created_at) AS last_active_at
         FROM clients c
         LEFT JOIN activity_events ae ON ae.entity_id = c.id
           AND ae.tenant_id = c.tenant_id
           AND ae.created_at BETWEEN $2 AND $3
         WHERE c.tenant_id = $1
         GROUP BY c.id, c.name
         ORDER BY event_count DESC, last_active_at DESC NULLS LAST`,
        [tenantId, startDate, endDate],
      )

      const rows = result.rows.map((r: any) => ({
        client_id: r.client_id,
        client_name: r.client_name,
        event_count: parseInt(r.event_count, 10),
        last_active_at: r.last_active_at ?? null,
      }))

      if (request.query.format === 'csv') {
        const csv = rowsToCsv(
          ['client_id', 'client_name', 'event_count', 'last_active_at'],
          rows,
        )
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', 'attachment; filename="client-activity-report.csv"')
          .send(csv)
      }

      return reply.code(200).send(rows)
    },
  })
}
