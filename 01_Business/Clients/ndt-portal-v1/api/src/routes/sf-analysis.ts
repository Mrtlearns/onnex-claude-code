/**
 * Salesforce Analysis API routes.
 *
 * Mounted at: /sf-analysis
 *
 * GET  /sf-analysis/customers                  — search accounts (?q=&limit=20)
 * GET  /sf-analysis/customers/:sfId/activity   — jobs + quotes for an account
 * GET  /sf-analysis/parts                      — BOM parts (?service=&q=&accountId=&limit=50&offset=0)
 * POST /sf-analysis/chat                       — text-to-SQL AI chatbot
 */

import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { requirePermission } from '../middleware/requirePermission';

// ── LLM call ─────────────────────────────────────────────────────────────────
// Uses Anthropic SDK directly when ANTHROPIC_API_KEY is set (local dev).
// Falls back to the internal pipeline gateway (Docker / production).

const GATEWAY_URL   = process.env.GATEWAY_URL ?? 'http://gateway:8012';
const SF_CHAT_MODEL = 'claude-haiku-4-5-20251001';

interface ChatMsg { role: 'user' | 'assistant' | 'system'; content: string }

async function llmCall(
  messages: ChatMsg[],
  systemPrompt: string,
  maxTokens: number,
): Promise<string> {
  // Direct SDK path — used when ANTHROPIC_API_KEY is available (local dev)
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    const response = await client.messages.create({
      model:      SF_CHAT_MODEL,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }

  // Gateway path — used in Docker where the pipeline gateway handles auth
  const userPrompt = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  const resp = await fetch(`${GATEWAY_URL}/analyze`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      intake_id:       crypto.randomUUID(),
      sanitize_job_id: '00000000-0000-0000-0000-000000000001',
      classification:  'CLEAN',
      llm_routing:     'CLOUD_OK',
      system_prompt:   systemPrompt,
      prompt:          userPrompt,
      model:           SF_CHAT_MODEL,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gateway error ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = await resp.json() as { response_json: Record<string, unknown> };
  return (data.response_json?.raw as string) ?? '';
}

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

const SF_SCHEMA_DDL = `
-- MASTER DATA
sf.accounts (sf_id TEXT PK, name TEXT, type TEXT, market TEXT, status TEXT,
  oem_approvals TEXT[], rate_sheet_ver TEXT, payment_terms TEXT, ytd_total NUMERIC,
  billing_state TEXT, billing_country TEXT, billing_city TEXT,
  owner_name TEXT, created_date DATE, phone TEXT,
  techniques_criterias TEXT, wo_notes TEXT, add_wo_notes TEXT, add_wo_notes_2 TEXT,
  region TEXT, client_types TEXT[], faa_account BOOLEAN, top_10_account BOOLEAN,
  credit_hold BOOLEAN, courier TEXT, courier_acct TEXT, delivery_methods TEXT,
  ytd_lab_revenue NUMERIC, ytd_field_revenue NUMERIC,
  lab_pricing_direction TEXT, admin_fee_pct NUMERIC, competitors TEXT[],
  synced_at TIMESTAMPTZ)

sf.contacts (sf_id TEXT PK, account_sf_id TEXT FK→sf.accounts, account_name TEXT,
  first_name TEXT, last_name TEXT, full_name TEXT, email TEXT, phone TEXT,
  title TEXT, department TEXT, is_active BOOLEAN, synced_at TIMESTAMPTZ)

sf.products (sf_id TEXT PK, product_code TEXT UNIQUE, name TEXT, family TEXT,
  description TEXT, std_price NUMERIC, union_price NUMERIC, faa_price NUMERIC,
  is_active BOOLEAN, synced_at TIMESTAMPTZ)

sf.pricebook_entries (sf_id TEXT PK, product_sf_id TEXT FK→sf.products,
  product_code TEXT, product_name TEXT, pricebook_name TEXT, currency TEXT,
  unit_price NUMERIC, list_price NUMERIC, is_active BOOLEAN, synced_at TIMESTAMPTZ)

sf.contracts (sf_id TEXT PK, account_sf_id TEXT FK→sf.accounts,
  contract_number TEXT, status TEXT, start_date DATE, end_date DATE,
  billing_frequency TEXT, total_value NUMERIC, description TEXT,
  owner_name TEXT, synced_at TIMESTAMPTZ)

-- BOM MASTER (authoritative — what SHOULD be used for a part)
sf.bom_items (sf_id TEXT PK, account_sf_id TEXT FK→sf.accounts,
  part_number TEXT, part_rev TEXT, drawing_number TEXT,
  service TEXT, specification TEXT, technique TEXT, ndt_procedure TEXT,
  acceptance_criteria TEXT, material TEXT, notes TEXT,
  is_active BOOLEAN, effective_date DATE, synced_at TIMESTAMPTZ)

-- TRANSACTION DATA
sf.jobs (sf_id TEXT PK, account_sf_id TEXT FK→sf.accounts, account_name TEXT,
  work_order_number TEXT, invoice_number TEXT, invoice_amount NUMERIC,
  part_number TEXT, part_rev TEXT, lot_serial TEXT, services TEXT[],
  specification TEXT, ndt_procedure TEXT, acceptance_criteria TEXT,
  scope TEXT, po_number TEXT, price_per_basis TEXT,
  date_received DATE, date_completed DATE, record_type TEXT, close_date DATE,
  stage_name TEXT, amount NUMERIC, owner_name TEXT, created_date DATE,
  description TEXT, is_won BOOLEAN, is_closed BOOLEAN,
  lab_status TEXT, billing_status TEXT, date_due DATE, contact_sf_id TEXT,
  qty_received NUMERIC, lab_notes TEXT, billing_notes TEXT,
  faa_job BOOLEAN, expedite BOOLEAN, expedite_type TEXT, expedite_fee NUMERIC,
  inspection_time_min NUMERIC, film_sq_in NUMERIC,
  subtotal NUMERIC, total NUMERIC, admin_fee_amount NUMERIC, pricing_details TEXT,
  synced_at TIMESTAMPTZ)

sf.quotes (sf_id TEXT PK, job_sf_id TEXT FK→sf.jobs, account_sf_id TEXT FK→sf.accounts,
  quote_number TEXT, part_numbers TEXT, services_included TEXT[], grand_total NUMERIC,
  status TEXT, created_date TIMESTAMPTZ, expiration_date DATE, pricing_basis TEXT,
  notes TEXT, description TEXT, synced_at TIMESTAMPTZ)

sf.quote_lines (sf_id TEXT PK, quote_sf_id TEXT FK→sf.quotes, product_code TEXT,
  product_name TEXT, quantity NUMERIC, unit_price NUMERIC, total_price NUMERIC,
  list_price NUMERIC, description TEXT, line_number INTEGER, synced_at TIMESTAMPTZ)

sf.orders (sf_id TEXT PK, account_sf_id TEXT FK→sf.accounts,
  opportunity_sf_id TEXT FK→sf.jobs, order_number TEXT, status TEXT,
  order_start_date DATE, total_amount NUMERIC, po_number TEXT,
  description TEXT, owner_name TEXT, synced_at TIMESTAMPTZ)

sf.order_items (sf_id TEXT PK, order_sf_id TEXT FK→sf.orders,
  product_sf_id TEXT FK→sf.products, product_code TEXT, product_name TEXT,
  quantity NUMERIC, unit_price NUMERIC, total_price NUMERIC,
  description TEXT, synced_at TIMESTAMPTZ)

-- ANALYTICAL VIEWS
sf.bom_parts MATERIALIZED VIEW (account_sf_id TEXT, account_name TEXT, part_number TEXT,
  revisions TEXT[], services TEXT[], specifications TEXT[], procedures TEXT[],
  acceptance_criteria TEXT[], job_count BIGINT, last_processed DATE,
  avg_invoice NUMERIC, max_invoice NUMERIC,
  last_specification TEXT, last_technique TEXT,
  last_acceptance_criteria TEXT, last_services TEXT[])

sf.part_last_used VIEW (account_sf_id TEXT, account_name TEXT, part_number TEXT,
  last_rev TEXT, last_services TEXT[], last_specification TEXT,
  last_technique TEXT, last_acceptance_criteria TEXT, last_scope TEXT,
  last_work_order TEXT, last_invoice_number TEXT, last_invoice_amount NUMERIC,
  last_stage TEXT, last_job_was_won BOOLEAN,
  last_job_date DATE, last_completed_date DATE, last_received_date DATE,
  last_record_type TEXT, last_job_sf_id TEXT)

-- NOTES FOR SQL GENERATION:
-- NDT service values: RT, UT, MT, PT, ET, VT (stored in services TEXT[] on jobs)
-- sf.part_last_used answers "what spec/technique did we last use for part X at account Y?"
-- sf.bom_items = authoritative master BOM; sf.bom_parts = aggregated job history
-- is_won=true means closed-won opportunity; is_closed=true means any closed stage
-- lab_status/billing_status = operational pipeline statuses on jobs (e.g. 'In Lab', 'Invoiced') — distinct from stage_name
-- faa_job=true / faa_account=true for FAA-regulated jobs and accounts
-- expedite=true for rush jobs; date_due is the lab due date (may differ from close_date)
-- credit_hold=true for accounts on credit hold
-- techniques_criterias on sf.accounts = per-account standard techniques and criteria (BOM text field)
-- For array columns use: value = ANY(column) or column && ARRAY['val1','val2']
`;

const SQL_SYSTEM_PROMPT = `You are a SQL generator for a PostgreSQL database used by an NDT (Non-Destructive Testing) lab.

SCHEMA:
${SF_SCHEMA_DDL}

RULES:
- Only SELECT statements. No DML/DDL.
- Always include LIMIT 200 unless already present.
- For array columns use: value = ANY(column)
- For text search use ILIKE.
- NDT service canonical values: RT, UT, MT, PT, ET, VT
- lab_status/billing_status track operational progress; stage_name tracks SF opportunity stage
- faa_job/faa_account: use WHERE faa_job = true or WHERE faa_account = true
- expedite=true for rush jobs; date_due for lab due dates
- credit_hold=true for accounts on credit hold
- techniques_criterias on sf.accounts contains per-account standard techniques text
- Return ONLY the raw SQL — no markdown fences, no comments, no explanation.
- If the question is out of scope: SELECT 'Cannot answer: question out of scope' AS message;`;

function validateSql(sql: string): string | null {
  const normalized = sql.trim().toUpperCase();
  if (!normalized.startsWith('SELECT')) {
    return 'Only SELECT statements are allowed';
  }
  const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'TRUNCATE', 'ALTER', 'GRANT', 'EXECUTE', '--'];
  for (const kw of blocked) {
    if (new RegExp(`\\b${kw}\\b`).test(normalized)) {
      return `Statement contains forbidden keyword: ${kw}`;
    }
  }
  return null;
}

function cleanSql(raw: string): string {
  return raw
    .replace(/^```(?:sql)?\n?/i, '')
    .replace(/\n?```$/, '')
    .trim();
}

// ── GET /sf-analysis/customers ────────────────────────────────────────────────
router.get('/customers', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const q     = (req.query.q as string | undefined)?.trim() ?? '';
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const pool = getPool();
  try {
    const countRow = await pool.query(`SELECT count(*) FROM sf.accounts`);
    const total    = Number(countRow.rows[0].count);

    if (total === 0) {
      res.json({ accounts: [], total: 0, noSyncYet: true });
      return;
    }

    const params: unknown[] = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE a.name ILIKE $1`;
    }

    const result = await pool.query(
      `SELECT a.sf_id, a.name, a.market, a.status, a.type,
              a.ytd_total::float, a.payment_terms,
              a.region, a.credit_hold, a.faa_account, a.top_10_account,
              COUNT(j.sf_id)::int AS job_count
       FROM sf.accounts a
       LEFT JOIN sf.jobs j ON j.account_sf_id = a.sf_id
       ${where}
       GROUP BY a.sf_id, a.name, a.market, a.status, a.type, a.ytd_total, a.payment_terms,
                a.region, a.credit_hold, a.faa_account, a.top_10_account
       ORDER BY COUNT(j.sf_id) DESC, a.name
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );

    res.json({ accounts: result.rows, total, noSyncYet: false });
  } catch (err) {
    console.error('[sf-analysis/customers]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ── GET /sf-analysis/customers/:sfId/activity ─────────────────────────────────
router.get('/customers/:sfId/activity', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const sfId = req.params.sfId;
  const pool = getPool();
  try {
    const [acctRow, jobsRow, quotesRow] = await Promise.all([
      pool.query(
        `SELECT sf_id, name, market, status, oem_approvals, ytd_total::float,
                techniques_criterias, wo_notes, region, credit_hold, faa_account,
                top_10_account, billing_state, billing_city, phone, owner_name,
                payment_terms, ytd_lab_revenue::float, ytd_field_revenue::float
         FROM sf.accounts WHERE sf_id = $1`,
        [sfId],
      ),
      pool.query(
        `SELECT sf_id, 'job' AS row_type, work_order_number, part_number,
                services, specification, ndt_procedure, acceptance_criteria,
                invoice_amount::float, date_received, date_completed,
                lab_status, billing_status, faa_job, expedite, expedite_type,
                date_due, lab_notes
         FROM sf.jobs
         WHERE account_sf_id = $1
         ORDER BY COALESCE(date_completed, date_received) DESC NULLS LAST`,
        [sfId],
      ),
      pool.query(
        `SELECT sf_id, 'quote' AS row_type, quote_number, part_numbers,
                services_included, grand_total::float, status, created_date, expiration_date
         FROM sf.quotes
         WHERE account_sf_id = $1
         ORDER BY COALESCE(created_date, synced_at) DESC NULLS LAST`,
        [sfId],
      ),
    ]);

    if (acctRow.rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const jobs   = jobsRow.rows;
    const quotes = quotesRow.rows;

    // Merge and sort by date DESC
    const activity = [...jobs, ...quotes].sort((a, b) => {
      const da = String(a.date_completed ?? a.date_received ?? a.created_date ?? '');
      const db = String(b.date_completed ?? b.date_received ?? b.created_date ?? '');
      return db < da ? -1 : db > da ? 1 : 0;
    });

    res.json({
      account:    acctRow.rows[0],
      activity,
      jobCount:   jobs.length,
      quoteCount: quotes.length,
    });
  } catch (err) {
    console.error('[sf-analysis/customers/:sfId/activity]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ── GET /sf-analysis/parts ────────────────────────────────────────────────────
router.get('/parts', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const q         = (req.query.q         as string | undefined)?.trim() ?? '';
  const service   = (req.query.service   as string | undefined)?.trim() ?? '';
  const accountId = (req.query.accountId as string | undefined)?.trim() ?? '';
  const limit     = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset    = Number(req.query.offset ?? 0);

  const conditions: string[] = [];
  const params: unknown[]    = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`b.part_number ILIKE $${params.length}`);
  }
  if (service) {
    params.push(service.toUpperCase());
    conditions.push(`$${params.length} = ANY(b.services)`);
  }
  if (accountId) {
    params.push(accountId);
    conditions.push(`b.account_sf_id = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  try {
    const [result, countResult] = await Promise.all([
      pool.query(
        `SELECT b.account_sf_id, b.account_name, b.part_number, b.revisions,
                b.services, b.specifications, b.procedures, b.acceptance_criteria,
                b.job_count, b.last_processed,
                b.avg_invoice::float, b.max_invoice::float,
                b.last_specification, b.last_technique,
                b.last_acceptance_criteria, b.last_services
         FROM sf.bom_parts b
         ${where}
         ORDER BY b.job_count DESC, b.part_number
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      pool.query(
        `SELECT count(*) FROM sf.bom_parts b ${where}`,
        params,
      ),
    ]);

    res.json({
      total:  Number(countResult.rows[0].count),
      limit,
      offset,
      items:  result.rows,
    });
  } catch (err) {
    console.error('[sf-analysis/parts]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ── POST /sf-analysis/chat ────────────────────────────────────────────────────
router.post('/chat', requirePermission('SF_ANALYSIS_CHAT'), async (req: Request, res: Response) => {
  const { messages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const pool = getPool();
  try {
    // Step 1: Generate SQL
    let sql = cleanSql(await llmCall(messages, SQL_SYSTEM_PROMPT, 400));

    const validationError = validateSql(sql);
    if (validationError) {
      res.json({ sql, columns: [], results: [], explanation: null, error: validationError });
      return;
    }

    if (!sql.toUpperCase().includes('LIMIT')) {
      sql = sql.replace(/;?\s*$/, ' LIMIT 200');
    }

    // Step 2: Execute (one retry on SQL error)
    let rows: unknown[]   = [];
    let columns: string[] = [];
    let execError: string | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await pool.query(sql);
        rows      = result.rows;
        columns   = result.fields.map(f => f.name);
        execError = null;
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (attempt === 0) {
          const retryMessages: ChatMsg[] = [
            ...messages,
            { role: 'assistant', content: sql },
            { role: 'user',      content: `That query failed: ${errMsg}\n\nReturn only the corrected SQL.` },
          ];
          sql = cleanSql(await llmCall(retryMessages, SQL_SYSTEM_PROMPT, 400));
          const retryVal = validateSql(sql);
          if (retryVal) { execError = retryVal; break; }
          if (!sql.toUpperCase().includes('LIMIT')) {
            sql = sql.replace(/;?\s*$/, ' LIMIT 200');
          }
        } else {
          execError = errMsg;
        }
      }
    }

    if (execError) {
      res.json({ sql, columns: [], results: [], explanation: null, error: execError });
      return;
    }

    // Step 3: Natural language explanation
    const preview       = rows.slice(0, 5);
    const explMessages: ChatMsg[] = [
      { role: 'user', content: `SQL query:\n\`\`\`sql\n${sql}\n\`\`\`\n\nReturned ${rows.length} rows. First few:\n${JSON.stringify(preview, null, 2)}\n\nColumns: ${columns.join(', ')}\n\nProvide a 2–4 sentence natural language summary of what this data shows.` },
    ];
    const explanation = (await llmCall(explMessages, 'You are a helpful data analyst. Summarize query results concisely.', 512)).trim() || null;

    res.json({ sql, columns, results: rows, explanation });
  } catch (err) {
    console.error('[sf-analysis/chat]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

export default router;
