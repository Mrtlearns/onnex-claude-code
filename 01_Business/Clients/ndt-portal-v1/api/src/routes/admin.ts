/**
 * Admin API routes. AI analytics uses SQL tool calling — no context injection.
 *
 * Mounted at: /admin
 *
 * GET  /admin/jobs               — paginated job_runs (?limit=50&offset=0&job=sf_sync)
 * GET  /admin/jobs/:id           — single job run detail
 * GET  /admin/analytics          — analytics data (?start=YYYY-MM-DD&end=YYYY-MM-DD)
 * POST /admin/sync/trigger       — queue a manual sf_sync run
 * POST /admin/ai-query           — AI data analyst query
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

function getPool(): Pool {
  return new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });
}

// ─── GET /admin/jobs ──────────────────────────────────────────────────────────
router.get('/jobs', requirePermission('ADMIN_VIEW'), async (req: Request, res: Response) => {
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const job    = (req.query.job as string | undefined)?.trim() ?? '';

  const pool = getPool();
  try {
    const conditions: string[] = [];
    const params: unknown[]    = [];

    if (job) {
      params.push(job);
      conditions.push(`job_name = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT count(*) FROM app.job_runs ${where}`,
      params,
    );
    const total = Number(countResult.rows[0].count);

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT id, job_name, started_at, finished_at, duration_ms, status,
              records_upserted, summary, error
       FROM app.job_runs
       ${where}
       ORDER BY started_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ total, runs: result.rows });
  } catch (err) {
    console.error('[admin/jobs]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ─── GET /admin/jobs/:id ──────────────────────────────────────────────────────
router.get('/jobs/:id', requirePermission('ADMIN_VIEW'), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, job_name, started_at, finished_at, duration_ms, status,
              records_upserted, summary, error
       FROM app.job_runs WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/jobs/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ─── GET /admin/analytics ─────────────────────────────────────────────────────
router.get('/analytics', requirePermission('ADMIN_VIEW'), async (req: Request, res: Response) => {
  const now   = new Date();
  const end   = (req.query.end   as string | undefined)?.trim() || now.toISOString().slice(0, 10);
  const start = (req.query.start as string | undefined)?.trim() || new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const pool = getPool();
  try {
    // KPIs
    const [sfRevRow, activeAccRow, sfJobsRow, winRateRow, avgAccRow, pipelineRow, lastSyncRow, momRow, wipRow, expiringRow] =
      await Promise.all([
        pool.query(`SELECT COALESCE(SUM(invoice_amount),0)::float AS val FROM sf.jobs WHERE invoice_amount > 0 AND COALESCE(date_completed, date_received, close_date) BETWEEN $1 AND $2`, [start, end]),
        pool.query(`SELECT COUNT(*)::int AS val FROM sf.accounts WHERE status = 'Active'`),
        pool.query(`SELECT COUNT(*)::int AS val FROM sf.jobs WHERE COALESCE(date_completed, date_received, close_date) BETWEEN $1 AND $2`, [start, end]),
        pool.query(`SELECT ROUND(COUNT(*) FILTER (WHERE LOWER(status)='approved')::numeric / NULLIF(COUNT(*),0)*100,1)::float AS val FROM sf.quotes WHERE (created_date BETWEEN $1 AND $2 OR (created_date IS NULL AND synced_at BETWEEN $1 AND $2))`, [start, end]),
        pool.query(`SELECT COALESCE(AVG(grand_total),0)::float AS val FROM sf.quotes WHERE LOWER(status)='approved' AND (created_date BETWEEN $1 AND $2 OR (created_date IS NULL AND synced_at BETWEEN $1 AND $2))`, [start, end]),
        pool.query(`SELECT COALESCE(SUM(grand_total),0)::float AS val FROM ut.incoming_quotes WHERE status IN ('calculated','pending','sent')`),
        pool.query(`SELECT job_name, started_at, status, records_upserted, summary FROM app.job_runs ORDER BY started_at DESC LIMIT 1`),
        pool.query(`
          WITH latest AS (
            SELECT MAX(date_trunc('month', COALESCE(date_completed, date_received, close_date))) AS max_mo
            FROM sf.jobs WHERE invoice_amount > 0
          ),
          m AS (
            SELECT date_trunc('month', COALESCE(j.date_completed, j.date_received, j.close_date)) AS mo,
                   COALESCE(SUM(j.invoice_amount),0)::float AS rev
            FROM sf.jobs j, latest
            WHERE COALESCE(j.date_completed, j.date_received, j.close_date) >= (latest.max_mo - interval '1 month')
              AND j.invoice_amount > 0
            GROUP BY 1 ORDER BY 1
          ) SELECT * FROM m
        `),
        // WIP / Active backlog — jobs with no date_completed but have invoice_amount
        pool.query(`
          SELECT COUNT(*)::int AS job_count, COALESCE(SUM(invoice_amount),0)::float AS backlog_value
          FROM sf.jobs
          WHERE date_completed IS NULL AND invoice_amount > 0
        `),
        // Quotes expiring soon
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int AS expiring_30d,
            COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE AND LOWER(status) NOT IN ('approved','rejected','expired'))::int AS stale
          FROM sf.quotes
        `),
      ]);

    const momRows = momRow.rows;
    let momGrowth: number | null = null;
    if (momRows.length >= 2) {
      const prev = Number(momRows[momRows.length - 2].rev);
      const curr = Number(momRows[momRows.length - 1].rev);
      momGrowth = prev > 0 ? Math.round((curr - prev) / prev * 1000) / 10 : null;
    }

    const lastSync = lastSyncRow.rows[0]
      ? { at: lastSyncRow.rows[0].started_at, status: lastSyncRow.rows[0].status, summary: lastSyncRow.rows[0].summary ?? '' }
      : null;

    // Chart queries
    const [
      quoteTrendRow, statusDistRow, sourceDistRow, topCustRow,
      sfRevTrendRow, sfServiceRow, sfMarketsRow, winRateTrendRow,
      // SF analytics
      yoyRevenueRow, topAccountsRow, turnaroundRow,
      serviceRevTrendRow, avgInvoiceSvcRow, marketRevTrendRow,
      // New
      quoteVarianceRow, procedureRow,
    ] = await Promise.all([
        pool.query(`
          SELECT date_trunc('month', created_at) AS month,
                 COUNT(*) AS count, COALESCE(SUM(grand_total),0)::float AS revenue, 'ut' AS type
          FROM ut.incoming_quotes WHERE created_at BETWEEN $1 AND $2 GROUP BY 1
          UNION ALL
          SELECT date_trunc('month', created_at), COUNT(*), COALESCE(SUM(grand_total),0)::float, 'rt'
          FROM rt.incoming_quotes WHERE created_at BETWEEN $1 AND $2 GROUP BY 1
          ORDER BY 1
        `, [start, end]),
        pool.query(`
          SELECT status, COUNT(*)::int AS count, COALESCE(SUM(grand_total),0)::float AS value
          FROM ut.incoming_quotes WHERE created_at BETWEEN $1 AND $2 GROUP BY status
        `, [start, end]),
        pool.query(`
          SELECT source, COUNT(*)::int AS count FROM ut.incoming_quotes
          WHERE created_at BETWEEN $1 AND $2 GROUP BY source
        `, [start, end]),
        pool.query(`
          SELECT customer_name, COUNT(*)::int AS quote_count, COALESCE(SUM(grand_total),0)::float AS total_value
          FROM ut.incoming_quotes WHERE created_at BETWEEN $1 AND $2
          GROUP BY customer_name ORDER BY total_value DESC LIMIT 10
        `, [start, end]),
        pool.query(`
          SELECT date_trunc('month', date_completed) AS month,
                 COALESCE(SUM(invoice_amount),0)::float AS revenue, COUNT(*)::int AS job_count
          FROM sf.jobs WHERE COALESCE(date_completed, date_received, close_date) BETWEEN $1 AND $2 AND invoice_amount > 0
          GROUP BY 1 ORDER BY 1
        `, [start, end]),
        pool.query(`
          SELECT unnest(services) AS service, COUNT(*)::int AS count,
                 COALESCE(SUM(invoice_amount),0)::float AS revenue
          FROM sf.jobs WHERE COALESCE(date_completed, date_received, close_date) BETWEEN $1 AND $2
          GROUP BY 1 ORDER BY count DESC LIMIT 10
        `, [start, end]),
        pool.query(`
          SELECT market, COUNT(*)::int AS count, COALESCE(SUM(ytd_total),0)::float AS ytd
          FROM sf.accounts WHERE market IS NOT NULL
          GROUP BY market ORDER BY count DESC
        `),
        pool.query(`
          SELECT date_trunc('month', synced_at) AS month,
                 COUNT(*) FILTER (WHERE LOWER(status)='approved')::int AS accepted,
                 COUNT(*)::int AS total,
                 ROUND(COUNT(*) FILTER (WHERE LOWER(status)='approved')::numeric / NULLIF(COUNT(*),0)*100,1)::float AS win_rate
          FROM sf.quotes WHERE (created_date BETWEEN $1 AND $2 OR (created_date IS NULL AND synced_at BETWEEN $1 AND $2))
          GROUP BY 1 ORDER BY 1
        `, [start, end]),

        // A. YoY Revenue — always last 2 calendar years, no date filter
        pool.query(`
          SELECT
            EXTRACT(YEAR  FROM date_completed)::int  AS year,
            EXTRACT(MONTH FROM date_completed)::int  AS month,
            COALESCE(SUM(invoice_amount), 0)::float  AS revenue,
            COUNT(*)::int                            AS job_count
          FROM sf.jobs
          WHERE date_completed >= date_trunc('year', now()) - interval '1 year'
            AND date_completed IS NOT NULL AND invoice_amount > 0
          GROUP BY 1, 2 ORDER BY 1, 2
        `),

        // B. Top 15 accounts by lifetime revenue — all-time
        pool.query(`
          SELECT
            account_name,
            COUNT(*)::int                                                         AS job_count,
            COALESCE(SUM(invoice_amount), 0)::float                              AS lifetime_revenue,
            COALESCE(AVG(invoice_amount) FILTER (WHERE invoice_amount > 0), 0)::float AS avg_invoice
          FROM sf.jobs
          WHERE account_name IS NOT NULL AND invoice_amount > 0
          GROUP BY account_name
          ORDER BY lifetime_revenue DESC LIMIT 15
        `),

        // C. Job turnaround time trend (avg days received→completed, monthly)
        pool.query(`
          SELECT
            date_trunc('month', date_completed)                              AS month,
            ROUND(AVG(date_completed - date_received)::numeric, 1)::float   AS avg_days,
            COUNT(*)::int                                                     AS job_count
          FROM sf.jobs
          WHERE date_received IS NOT NULL AND date_completed IS NOT NULL
            AND COALESCE(date_completed, date_received, close_date) BETWEEN $1 AND $2
          GROUP BY 1 ORDER BY 1
        `, [start, end]),

        // D. Service revenue trend — top 5 services, monthly
        // Note: CROSS JOIN LATERAL unnest(services) attributes revenue to each service
        // on multi-service jobs — cross-service total exceeds overall total intentionally.
        pool.query(`
          WITH top_svc AS (
            SELECT unnest(services) AS svc, SUM(invoice_amount) AS total
            FROM sf.jobs WHERE invoice_amount > 0
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5
          ),
          monthly AS (
            SELECT
              date_trunc('month', j.date_completed) AS month,
              s.svc                                 AS service,
              COALESCE(SUM(j.invoice_amount), 0)::float AS revenue
            FROM sf.jobs j
            CROSS JOIN LATERAL unnest(j.services) AS s(svc)
            JOIN top_svc ts ON ts.svc = s.svc
            WHERE COALESCE(j.date_completed, j.date_received, j.close_date) BETWEEN $1 AND $2 AND j.invoice_amount > 0
            GROUP BY 1, 2
          )
          SELECT * FROM monthly ORDER BY month, service
        `, [start, end]),

        // E. Avg invoice by service type
        pool.query(`
          SELECT
            unnest(services)                                                           AS service,
            COUNT(*)::int                                                               AS job_count,
            COALESCE(AVG(invoice_amount) FILTER (WHERE invoice_amount > 0), 0)::float  AS avg_invoice,
            COALESCE(SUM(invoice_amount), 0)::float                                    AS total_revenue
          FROM sf.jobs
          WHERE COALESCE(date_completed, date_received, close_date) BETWEEN $1 AND $2
          GROUP BY 1 ORDER BY total_revenue DESC LIMIT 10
        `, [start, end]),

        // F. Market revenue trend — top 5 markets, monthly
        // Note: same per-service revenue attribution rationale as query D.
        pool.query(`
          WITH top_mkts AS (
            SELECT a.market, SUM(j.invoice_amount) AS total
            FROM sf.jobs j JOIN sf.accounts a ON a.sf_id = j.account_sf_id
            WHERE j.invoice_amount > 0 AND a.market IS NOT NULL
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5
          ),
          monthly AS (
            SELECT
              date_trunc('month', j.date_completed) AS month,
              a.market,
              COALESCE(SUM(j.invoice_amount), 0)::float AS revenue,
              COUNT(*)::int                              AS job_count
            FROM sf.jobs j
            JOIN sf.accounts a ON a.sf_id = j.account_sf_id
            JOIN top_mkts tm    ON tm.market = a.market
            WHERE COALESCE(j.date_completed, j.date_received, j.close_date) BETWEEN $1 AND $2 AND j.invoice_amount > 0
            GROUP BY 1, 2
          )
          SELECT * FROM monthly ORDER BY month, market
        `, [start, end]),

        // G. Quote vs. Actual Variance — approved quotes with linked jobs
        pool.query(`
          SELECT
            a.name AS account,
            ROUND(AVG(q.grand_total),2)::float AS avg_quoted,
            ROUND(AVG(j.invoice_amount),2)::float AS avg_invoiced,
            ROUND(AVG(j.invoice_amount - q.grand_total),2)::float AS avg_variance,
            COUNT(*)::int AS sample_count
          FROM sf.quotes q
          JOIN sf.jobs j ON j.sf_id = q.job_sf_id
          JOIN sf.accounts a ON a.sf_id = q.account_sf_id
          WHERE LOWER(q.status) = 'approved'
            AND j.invoice_amount > 0 AND q.grand_total > 0
            AND (q.created_date BETWEEN $1 AND $2 OR (q.created_date IS NULL AND q.synced_at BETWEEN $1 AND $2))
          GROUP BY 1 HAVING COUNT(*) >= 2
          ORDER BY ABS(AVG(j.invoice_amount - q.grand_total)) DESC LIMIT 10
        `, [start, end]),

        // H. NDT Procedure Breakdown — revenue + job count by procedure type
        pool.query(`
          SELECT
            ndt_procedure,
            COUNT(*)::int AS job_count,
            COALESCE(SUM(invoice_amount),0)::float AS revenue
          FROM sf.jobs
          WHERE ndt_procedure IS NOT NULL
            AND COALESCE(date_completed, date_received, close_date) BETWEEN $1 AND $2
          GROUP BY 1 ORDER BY revenue DESC LIMIT 12
        `, [start, end]),
      ]);

    // Merge quoteTrend by month
    const trendMap: Record<string, { month: string; utCount: number; rtCount: number; utRevenue: number; rtRevenue: number }> = {};
    for (const r of quoteTrendRow.rows) {
      const mo = new Date(r.month).toISOString().slice(0, 7);
      if (!trendMap[mo]) trendMap[mo] = { month: mo, utCount: 0, rtCount: 0, utRevenue: 0, rtRevenue: 0 };
      if (r.type === 'ut') { trendMap[mo].utCount = Number(r.count); trendMap[mo].utRevenue = Number(r.revenue); }
      else                 { trendMap[mo].rtCount = Number(r.count); trendMap[mo].rtRevenue = Number(r.revenue); }
    }

    res.json({
      period: { start, end },
      kpis: {
        sfTotalRevenue:   Number(sfRevRow.rows[0].val),
        activeAccounts:   Number(activeAccRow.rows[0].val),
        totalSfJobs:      Number(sfJobsRow.rows[0].val),
        quoteWinRate:     Number(winRateRow.rows[0].val ?? 0),
        avgAcceptedQuote: Number(avgAccRow.rows[0].val),
        pipelineValue:    Number(pipelineRow.rows[0].val),
        lastSync,
        momGrowth,
        wipJobCount:      Number(wipRow.rows[0]?.job_count ?? 0),
        wipBacklogValue:  Number(wipRow.rows[0]?.backlog_value ?? 0),
        quotesExpiring30d: Number(expiringRow.rows[0]?.expiring_30d ?? 0),
        quotesStale:      Number(expiringRow.rows[0]?.stale ?? 0),
      },
      quoteTrend:    Object.values(trendMap).sort((a, b) => a.month.localeCompare(b.month)),
      statusDist:    statusDistRow.rows.map(r => ({ status: r.status, count: Number(r.count), value: Number(r.value) })),
      sourceDist:    sourceDistRow.rows.map(r => ({ source: r.source, count: Number(r.count) })),
      topCustomers:  topCustRow.rows.map(r => ({ name: r.customer_name, quoteCount: Number(r.quote_count), totalValue: Number(r.total_value) })),
      sfRevenueTrend: sfRevTrendRow.rows.map(r => ({ month: new Date(r.month).toISOString().slice(0, 7), revenue: Number(r.revenue), jobCount: Number(r.job_count) })),
      sfServiceMix:  sfServiceRow.rows.map(r => ({ service: r.service, count: Number(r.count), revenue: Number(r.revenue) })),
      sfMarkets:     sfMarketsRow.rows.map(r => ({ market: r.market, count: Number(r.count), ytd: Number(r.ytd) })),
      winRateTrend:  winRateTrendRow.rows.map(r => ({ month: new Date(r.month).toISOString().slice(0, 7), accepted: Number(r.accepted), total: Number(r.total), winRate: Number(r.win_rate) })),
      yoyRevenue: yoyRevenueRow.rows.map(r => ({
        year: Number(r.year), month: Number(r.month),
        revenue: Number(r.revenue), jobCount: Number(r.job_count),
      })),
      topAccounts: topAccountsRow.rows.map(r => ({
        name: r.account_name,
        jobCount: Number(r.job_count),
        lifetimeRevenue: Number(r.lifetime_revenue),
        avgInvoice: Number(r.avg_invoice),
      })),
      turnaroundTrend: turnaroundRow.rows.map(r => ({
        month: new Date(r.month).toISOString().slice(0, 7),
        avgDays: Number(r.avg_days),
        jobCount: Number(r.job_count),
      })),
      serviceRevenueTrend: serviceRevTrendRow.rows.map(r => ({
        month: new Date(r.month).toISOString().slice(0, 7),
        service: r.service,
        revenue: Number(r.revenue),
      })),
      avgInvoiceByService: avgInvoiceSvcRow.rows.map(r => ({
        service: r.service,
        jobCount: Number(r.job_count),
        avgInvoice: Number(r.avg_invoice),
        totalRevenue: Number(r.total_revenue),
      })),
      marketRevenueTrend: marketRevTrendRow.rows.map(r => ({
        month: new Date(r.month).toISOString().slice(0, 7),
        market: r.market,
        revenue: Number(r.revenue),
        jobCount: Number(r.job_count),
      })),
      quoteVariance: quoteVarianceRow.rows.map(r => ({
        account: r.account,
        avgQuoted: Number(r.avg_quoted),
        avgInvoiced: Number(r.avg_invoiced),
        avgVariance: Number(r.avg_variance),
        sampleCount: Number(r.sample_count),
      })),
      procedureBreakdown: procedureRow.rows.map(r => ({
        procedure: r.ndt_procedure,
        jobCount: Number(r.job_count),
        revenue: Number(r.revenue),
      })),
    });
  } catch (err) {
    console.error('[admin/analytics]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ─── POST /admin/sync/trigger ─────────────────────────────────────────────────
router.post('/sync/trigger', requirePermission('ADMIN_VIEW'), async (req: Request, res: Response) => {
  const pool = getPool();
  try {
    // Check if a sync is already running (started within last 5 min, still running)
    const runningCheck = await pool.query(`
      SELECT id FROM app.job_runs
      WHERE job_name = 'sf_sync_manual' AND status = 'running'
        AND started_at > now() - interval '5 minutes'
      LIMIT 1
    `);
    if (runningCheck.rows.length > 0) {
      res.json({ status: 'already_running' });
      return;
    }

    // Insert queued trigger row
    await pool.query(`
      INSERT INTO app.job_runs (job_name, status, started_at)
      VALUES ('sf_sync_manual', 'queued', now())
    `);

    res.json({ status: 'queued' });
  } catch (err) {
    console.error('[admin/sync/trigger]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ─── POST /admin/ai-query ──────────────────────────────────────────────────────
// ── Analytics SQL tool ───────────────────────────────────────────────────────
// Validates and executes a SELECT-only query; same rules as sf-analysis.ts

const ANALYTICS_FORBIDDEN = /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|CREATE|ALTER|GRANT|EXECUTE|MERGE)\b/i;

function validateAnalyticsSql(sql: string): string | null {
  const trimmed = sql.trim();
  if (!trimmed.toUpperCase().startsWith('SELECT')) {
    return 'Only SELECT statements are allowed.';
  }
  if (ANALYTICS_FORBIDDEN.test(trimmed)) {
    return 'Forbidden keyword detected. Only SELECT is allowed.';
  }
  if (/--/.test(trimmed)) {
    return 'SQL comments are not allowed.';
  }
  return null; // valid
}

async function runAnalyticsSql(pool: Pool, sql: string): Promise<{ rows: unknown[]; rowCount: number; error?: string }> {
  // Auto-add LIMIT if missing to prevent runaway queries
  let safeSql = sql.trim();
  if (!/\bLIMIT\b/i.test(safeSql)) {
    safeSql = `${safeSql} LIMIT 500`;
  }
  try {
    const result = await pool.query(safeSql);
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  } catch (e) {
    return { rows: [], rowCount: 0, error: String(e) };
  }
}

// ── POST /admin/ai-query ──────────────────────────────────────────────────────
router.post('/ai-query', requirePermission('ADMIN_VIEW'), async (req: Request, res: Response) => {
  const { messages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const pool = getPool();
  try {
    // Load chat-specific settings (chat_provider / chat_model) with pipeline defaults as fallback
    const settingsResult = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM ut.app_settings
       WHERE key IN (
         'chat_provider',   'chat_model',
         'llm_provider',
         'openrouter_api_key','openrouter_model',
         'anthropic_api_key', 'anthropic_model',
         'openai_api_key',    'openai_model'
       )`,
    );
    const cfg: Record<string, string> = {};
    for (const row of settingsResult.rows) cfg[row.key] = row.value;

    // chat_provider takes precedence over the pipeline default provider
    const provider = cfg['chat_provider']?.trim() || cfg['llm_provider']?.trim() || 'anthropic';
    const apiKey   = cfg[`${provider}_api_key`]?.trim();

    if (!apiKey) {
      res.status(400).json({
        error: `No API key configured for provider "${provider}". Add it in Settings → LLM.`,
      });
      return;
    }

    // chat_model overrides the provider's default model
    const PROVIDER_MODEL_DEFAULTS: Record<string, string> = {
      openrouter: 'anthropic/claude-haiku-4-5',
      anthropic:  'claude-haiku-4-5-20251001',
      openai:     'gpt-4o-mini',
    };
    const model = cfg['chat_model']?.trim()
      || cfg[`${provider}_model`]?.trim()
      || PROVIDER_MODEL_DEFAULTS[provider]
      || 'claude-haiku-4-5-20251001';

    // System prompt — schema only, no pre-fetched data.
    // The AI uses run_analytics_sql to fetch exactly what it needs.
    const systemPrompt = `You are an AI data analyst for NDT Portal, a Non-Destructive Testing lab management system.

AVAILABLE DATABASE TABLES:
- ut.incoming_quotes  (quote_number TEXT, source TEXT, customer_name TEXT, status TEXT, grand_total NUMERIC, created_at TIMESTAMPTZ)
- rt.incoming_quotes  (same columns as ut.incoming_quotes)
- sf.accounts         (id, name TEXT, market TEXT, status TEXT, ytd_total NUMERIC, created_at)
- sf.jobs             (id, account_name TEXT, services TEXT[], invoice_amount NUMERIC, date_received DATE, date_completed DATE)
- sf.bom_parts        (id, account_name TEXT, part_number TEXT, job_count INT, avg_invoice NUMERIC)

HOW YOU MUST WORK:
1. ALWAYS call run_analytics_sql with a targeted SELECT to get the real data before answering.
2. NEVER guess, estimate, or invent numbers. Only report values returned by the tool.
3. If the first query doesn't fully answer the question, call the tool again with a more targeted query.
4. After you have the data, format your final answer as a JSON object with this exact shape:
   {"reply":"your markdown text","chartSpec":null}
   OR with a chart:
   {"reply":"text","chartSpec":{"type":"bar","title":"...","data":[...],"xKey":"...","yKeys":[{"key":"...","label":"...","color":"#6366f1"}]}}
5. Chart types: "bar", "line", "area", "pie". Max 12 data points. Dollar amounts as numbers (not strings).
6. Your ENTIRE final response must be ONE valid JSON object — no markdown fences, no text outside it.

TODAY: ${new Date().toISOString().split('T')[0]}
CURRENT QUARTER: Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;

    // Tool definition (shared shape for Anthropic and OpenAI-compat)
    const toolDefinition = {
      name: 'run_analytics_sql',
      description: 'Execute a SELECT SQL query against the NDT Portal PostgreSQL database. Use this to answer any question involving counts, totals, trends, or comparisons. Always use LIMIT. Returns {rows, rowCount} or {error}.',
      parameters: {  // OpenAI-compat shape
        type: 'object' as const,
        properties: {
          sql: { type: 'string', description: 'A valid SELECT statement. Use LIMIT to bound results.' },
        },
        required: ['sql'],
      },
    };

    // Anthropic tool shape
    const anthropicTool: Anthropic.Tool = {
      name: 'run_analytics_sql',
      description: toolDefinition.description,
      input_schema: {
        type: 'object' as const,
        properties: { sql: { type: 'string', description: toolDefinition.parameters.properties.sql.description } },
        required: ['sql'],
      },
    };

    let reply = 'Sorry, I could not process that request.';
    let chartSpec = null;

    function tryParseReply(candidate: string): boolean {
      try {
        const parsed = JSON.parse(candidate);
        if (typeof parsed === 'object' && parsed !== null && 'reply' in parsed) {
          reply     = String(parsed.reply ?? '');
          chartSpec = parsed.chartSpec ?? null;
          return true;
        }
      } catch { /* continue */ }
      return false;
    }

    if (provider === 'anthropic') {
      // ── Anthropic tool-use loop ─────────────────────────────────────────────
      const client = new Anthropic({ apiKey });
      const convo: Anthropic.MessageParam[] = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      for (let iteration = 0; iteration < 5; iteration++) {
        const response = await client.messages.create({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          tools: [anthropicTool],
          messages: convo,
        });

        if (response.stop_reason === 'end_turn') {
          // Final text response — parse as JSON
          const textBlock = response.content.find(b => b.type === 'text');
          const raw = textBlock?.type === 'text' ? textBlock.text : '';
          if (!tryParseReply(raw.trim())) {
            const fenced = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/```\s*([\s\S]*?)```/);
            if (fenced) tryParseReply(fenced[1].trim());
          }
          break;
        }

        if (response.stop_reason === 'tool_use') {
          // Execute tool calls and return results
          convo.push({ role: 'assistant', content: response.content });
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type !== 'tool_use') continue;
            if (block.name !== 'run_analytics_sql') continue;
            const input = block.input as { sql?: string };
            const validationError = input.sql ? validateAnalyticsSql(input.sql) : 'No SQL provided.';
            let resultContent: string;
            if (validationError) {
              resultContent = JSON.stringify({ error: validationError });
            } else {
              const result = await runAnalyticsSql(pool, input.sql!);
              resultContent = JSON.stringify(result);
            }
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultContent });
          }

          convo.push({ role: 'user', content: toolResults });
          continue;
        }

        // Unexpected stop reason — break
        break;
      }

    } else {
      // ── OpenRouter / OpenAI tool-use loop (OpenAI-compatible format) ─────────
      const baseUrl = provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1';

      const oaiMessages: Array<Record<string, unknown>> = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ];

      const oaiFunctions = [{
        type: 'function',
        function: {
          name: toolDefinition.name,
          description: toolDefinition.description,
          parameters: toolDefinition.parameters,
        },
      }];

      for (let iteration = 0; iteration < 5; iteration++) {
        const oaRes = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://ndt-v1.on-nex.us' } : {}),
          },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
            messages: oaiMessages,
            tools: oaiFunctions,
            tool_choice: 'auto',
          }),
        });

        if (!oaRes.ok) {
          const errBody = await oaRes.text();
          throw new Error(`${provider} API error ${oaRes.status}: ${errBody}`);
        }

        const oaData = await oaRes.json() as {
          choices: Array<{
            finish_reason: string;
            message: {
              role: string;
              content: string | null;
              tool_calls?: Array<{
                id: string;
                type: string;
                function: { name: string; arguments: string };
              }>;
            };
          }>;
        };

        const choice = oaData.choices?.[0];
        if (!choice) break;

        const msg = choice.message;
        oaiMessages.push(msg as Record<string, unknown>);

        if (choice.finish_reason === 'stop' || !msg.tool_calls?.length) {
          // Final text response
          const raw = msg.content ?? '';
          if (!tryParseReply(raw.trim())) {
            const fenced = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/```\s*([\s\S]*?)```/);
            if (fenced) tryParseReply(fenced[1].trim());
          }
          break;
        }

        if (choice.finish_reason === 'tool_calls' || msg.tool_calls?.length) {
          for (const tc of msg.tool_calls ?? []) {
            if (tc.function.name !== 'run_analytics_sql') continue;
            let parsedArgs: { sql?: string } = {};
            try { parsedArgs = JSON.parse(tc.function.arguments); } catch { /* skip */ }
            const validationError = parsedArgs.sql ? validateAnalyticsSql(parsedArgs.sql) : 'No SQL provided.';
            let resultContent: string;
            if (validationError) {
              resultContent = JSON.stringify({ error: validationError });
            } else {
              const result = await runAnalyticsSql(pool, parsedArgs.sql!);
              resultContent = JSON.stringify(result);
            }
            oaiMessages.push({ role: 'tool', tool_call_id: tc.id, content: resultContent });
          }
          continue;
        }

        break;
      }
    }

    res.json({ reply, chartSpec });
  } catch (err) {
    console.error('[admin/ai-query]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ─── GET /admin/portal-config ─────────────────────────────────────────────────
router.get('/portal-config', requirePermission('ADMIN_VIEW'), (_req: Request, res: Response) => {
  const domain = process.env.PORTAL_DOMAIN ?? 'ndt-v1.on-nex.us';
  res.json({ portalUrl: `https://${domain}` });
});

export default router;
