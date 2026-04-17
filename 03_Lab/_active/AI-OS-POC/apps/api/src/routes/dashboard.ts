// apps/api/src/routes/dashboard.ts
// Phase 10: Dashboard KPIs (role-aware) + Activity feed + Team Workload report
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

function getTenantId(request: any): string {
  return request.user?.tenantId ?? request.user?.tenant_id ?? ''
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // GET /api/v1/dashboard/kpis — role-aware KPI aggregates
  // finance/admin: overdue invoices count + amount
  // team_member: utilization_pct (hours this week / 40h)
  // manager/admin: open deals weighted value + team task count
  // all roles: active_projects count
  fastify.get('/api/v1/dashboard/kpis', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)
      const userId = request.user?.sub
      const role: string = request.user?.role ?? ''

      const kpis: Record<string, unknown> = {}

      if (['finance', 'admin', 'super_admin'].includes(role)) {
        // Overdue invoices: status='unpaid' or status='sent' AND due_date < NOW()
        const overdueResult = await pool.query(
          `SELECT
             COUNT(*) AS overdue_count,
             COALESCE(SUM(
               (SELECT COALESCE(SUM(qty * rate), 0) FROM invoice_line_items WHERE invoice_id = i.id)
             ), 0) AS overdue_amount
           FROM invoices i
           WHERE tenant_id = $1
             AND status IN ('sent', 'draft')
             AND due_date < NOW()`,
          [tenantId],
        )
        const overdueRow = overdueResult.rows[0] ?? {}
        kpis.overdue_invoices_count = parseInt(overdueRow.overdue_count ?? '0', 10)
        kpis.overdue_invoices_total = parseFloat(overdueRow.overdue_amount ?? '0')
      }

      if (role === 'team_member') {
        // Utilization: SUM(duration_minutes this week) / 2400 (40h * 60min)
        const utilResult = await pool.query(
          `SELECT COALESCE(SUM(duration_minutes), 0) AS total_minutes
           FROM time_entries
           WHERE tenant_id = $1
             AND user_id = $2
             AND date >= date_trunc('week', CURRENT_DATE)`,
          [tenantId, userId],
        )
        const totalMinutes = parseInt(utilResult.rows[0]?.total_minutes ?? '0', 10)
        kpis.utilization_pct = Math.round((totalMinutes / 2400) * 100)
      }

      if (['manager', 'admin', 'super_admin'].includes(role)) {
        // Open deals weighted value: SUM(value * probability / 100) for non-won/lost
        const dealsResult = await pool.query(
          `SELECT COALESCE(SUM(value * probability / 100.0), 0) AS open_deals_value
           FROM deals
           WHERE tenant_id = $1
             AND status NOT IN ('won', 'lost')`,
          [tenantId],
        )
        kpis.open_deals_value = parseFloat(dealsResult.rows[0]?.open_deals_value ?? '0')

        // Team task count: open tasks this week
        const workloadResult = await pool.query(
          `SELECT COUNT(*) AS team_workload_count
           FROM tasks
           WHERE tenant_id = $1
             AND status NOT IN ('done', 'cancelled')`,
          [tenantId],
        )
        kpis.team_workload_count = parseInt(workloadResult.rows[0]?.team_workload_count ?? '0', 10)
      }

      // All roles: active projects count
      const projectsResult = await pool.query(
        `SELECT COUNT(*) AS active_projects_count
         FROM projects
         WHERE tenant_id = $1
           AND LOWER(status) = 'active'`,
        [tenantId],
      )
      kpis.active_projects_count = parseInt(projectsResult.rows[0]?.active_projects_count ?? '0', 10)

      return reply.code(200).send({ kpis })
    },
  })

  // GET /api/v1/activity — last 20 activity events, tenant-scoped
  fastify.get('/api/v1/activity', {
    preHandler: [(fastify as any).authenticate],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)

      const result = await pool.query(
        `SELECT * FROM activity_events
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [tenantId],
      )

      return reply.code(200).send({ activity: result.rows })
    },
  })

  // GET /api/v1/reports/team-workload — manager/admin only
  // Returns per-assignee task count + total logged minutes this week
  fastify.get('/api/v1/reports/team-workload', {
    preHandler: [(fastify as any).authenticate, requireRole(['manager', 'admin', 'super_admin'])],
    handler: async (request: any, reply: any) => {
      const tenantId = getTenantId(request)

      const result = await pool.query(
        `SELECT
           t.assignee_id,
           COUNT(t.id) AS task_count,
           COALESCE(SUM(te.duration_minutes), 0) AS total_minutes
         FROM tasks t
         LEFT JOIN time_entries te
           ON te.tenant_id = t.tenant_id
           AND te.user_id = t.assignee_id
           AND te.date >= date_trunc('week', CURRENT_DATE)
         WHERE t.tenant_id = $1
           AND t.assignee_id IS NOT NULL
           AND t.status NOT IN ('done', 'cancelled')
         GROUP BY t.assignee_id
         ORDER BY task_count DESC`,
        [tenantId],
      )

      return reply.code(200).send({ teamWorkload: result.rows })
    },
  })
}
