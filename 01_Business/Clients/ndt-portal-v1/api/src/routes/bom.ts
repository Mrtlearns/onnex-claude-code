/**
 * BOM (Bill of Materials) query API.
 *
 * Mounted at: /bom
 *
 * Queries sf.* tables populated by the sf_sync.py script.
 * All endpoints are read-only — no auth required (internal portal).
 *
 * GET /bom/parts                       — search BOM (?q=, ?account=, ?service=, ?limit=, ?offset=)
 * GET /bom/parts/:partNumber/history   — all jobs for a part (?account= optional)
 * GET /bom/accounts                    — search accounts (?q=, ?limit=)
 * GET /bom/accounts/:sfId/parts        — all BOM entries for a customer
 * POST /bom/sync                       — trigger incremental sync on server (admin)
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { exec } from 'child_process';
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

// ─── GET /bom/parts ──────────────────────────────────────────────────────────
router.get('/parts', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const q       = (req.query.q       as string | undefined)?.trim() ?? '';
  const account = (req.query.account as string | undefined)?.trim() ?? '';
  const service = (req.query.service as string | undefined)?.trim() ?? '';
  const limit   = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset  = Number(req.query.offset ?? 0);

  const conditions: string[] = [];
  const params: unknown[]    = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`b.part_number ILIKE $${params.length}`);
  }
  if (account) {
    params.push(`%${account}%`);
    conditions.push(`b.account_name ILIKE $${params.length}`);
  }
  if (service) {
    params.push(service.toUpperCase());
    conditions.push(`$${params.length} = ANY(b.services)`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT
         b.account_sf_id,
         b.account_name,
         b.part_number,
         b.revisions,
         b.services,
         b.specifications,
         b.procedures,
         b.acceptance_criteria,
         b.job_count,
         b.last_processed,
         b.avg_invoice,
         b.max_invoice
       FROM sf.bom_parts b
       ${where}
       ORDER BY b.job_count DESC, b.part_number
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const countResult = await pool.query(
      `SELECT count(*) FROM sf.bom_parts b ${where}`,
      params,
    );

    return res.json({
      total:  Number(countResult.rows[0].count),
      limit,
      offset,
      items:  result.rows,
    });
  } catch (err) {
    console.error('[bom/parts] GET failed:', err);
    return res.status(500).json({ error: 'BOM query failed' });
  } finally {
    await pool.end();
  }
});

// ─── GET /bom/parts/:partNumber/history ──────────────────────────────────────
router.get('/parts/:partNumber/history', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const partNumber = req.params.partNumber;
  const account    = (req.query.account as string | undefined)?.trim() ?? '';
  const limit      = Math.min(Number(req.query.limit ?? 100), 500);

  const params: unknown[] = [partNumber];
  const conditions        = [`j.part_number = $1`];

  if (account) {
    params.push(`%${account}%`);
    conditions.push(`a.name ILIKE $${params.length}`);
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT
         j.sf_id,
         j.work_order_number,
         j.invoice_number,
         j.invoice_amount,
         j.part_number,
         j.part_rev,
         j.lot_serial,
         j.services,
         j.specification,
         j.ndt_procedure,
         j.acceptance_criteria,
         j.scope,
         j.po_number,
         j.price_per_basis,
         j.date_received,
         j.date_completed,
         j.record_type,
         j.account_sf_id,
         a.name AS account_name
       FROM sf.jobs j
       JOIN sf.accounts a ON a.sf_id = j.account_sf_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY COALESCE(j.date_completed, j.date_received) DESC NULLS LAST
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );

    return res.json({ partNumber, total: result.rowCount, jobs: result.rows });
  } catch (err) {
    console.error('[bom/parts/:partNumber/history] GET failed:', err);
    return res.status(500).json({ error: 'History query failed' });
  } finally {
    await pool.end();
  }
});

// ─── GET /bom/accounts ───────────────────────────────────────────────────────
router.get('/accounts', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const q     = (req.query.q as string | undefined)?.trim() ?? '';
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const pool = getPool();
  try {
    const params: unknown[] = [];
    let where = '';

    if (q) {
      params.push(`%${q}%`);
      where = `WHERE a.name ILIKE $1`;
    }

    const result = await pool.query(
      `SELECT
         a.sf_id,
         a.name,
         a.type,
         a.market,
         a.status,
         a.oem_approvals,
         a.rate_sheet_ver,
         a.payment_terms,
         a.ytd_total,
         count(j.sf_id) AS job_count
       FROM sf.accounts a
       LEFT JOIN sf.jobs j ON j.account_sf_id = a.sf_id
       ${where}
       GROUP BY a.sf_id, a.name, a.type, a.market, a.status,
                a.oem_approvals, a.rate_sheet_ver, a.payment_terms, a.ytd_total
       ORDER BY count(j.sf_id) DESC, a.name
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );

    return res.json({ total: result.rowCount, accounts: result.rows });
  } catch (err) {
    console.error('[bom/accounts] GET failed:', err);
    return res.status(500).json({ error: 'Account query failed' });
  } finally {
    await pool.end();
  }
});

// ─── GET /bom/accounts/:sfId/parts ───────────────────────────────────────────
router.get('/accounts/:sfId/parts', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const sfId   = req.params.sfId;
  const limit  = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);

  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT
         b.part_number,
         b.revisions,
         b.services,
         b.specifications,
         b.procedures,
         b.acceptance_criteria,
         b.job_count,
         b.last_processed,
         b.avg_invoice,
         b.max_invoice
       FROM sf.bom_parts b
       WHERE b.account_sf_id = $1
       ORDER BY b.job_count DESC, b.part_number
       LIMIT $2 OFFSET $3`,
      [sfId, limit, offset],
    );

    const acct = await pool.query(
      `SELECT sf_id, name, type, market, status, oem_approvals FROM sf.accounts WHERE sf_id = $1`,
      [sfId],
    );

    if (acct.rowCount === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.json({
      account: acct.rows[0],
      total:   result.rowCount,
      limit,
      offset,
      parts:   result.rows,
    });
  } catch (err) {
    console.error('[bom/accounts/:sfId/parts] GET failed:', err);
    return res.status(500).json({ error: 'Account parts query failed' });
  } finally {
    await pool.end();
  }
});

// ─── GET /bom/parts/:partNumber/last-used ────────────────────────────────────
// Returns the most recently used spec, technique, services and job metadata
// for a given part number from sf.part_last_used.
// Optional ?account= filter to scope to a specific customer account name.
router.get('/parts/:partNumber/last-used', requirePermission('SF_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const partNumber = req.params.partNumber;
  const account    = (req.query.account as string | undefined)?.trim() ?? '';

  const params: unknown[] = [partNumber];
  const conditions        = [`lu.part_number = $1`];

  if (account) {
    params.push(`%${account}%`);
    conditions.push(`lu.account_name ILIKE $${params.length}`);
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT
         lu.account_sf_id,
         lu.account_name,
         lu.part_number,
         lu.last_rev,
         lu.last_services,
         lu.last_specification,
         lu.last_technique,
         lu.last_acceptance_criteria,
         lu.last_scope,
         lu.last_work_order,
         lu.last_invoice_number,
         lu.last_invoice_amount,
         lu.last_stage,
         lu.last_job_was_won,
         lu.last_job_date,
         lu.last_completed_date,
         lu.last_received_date,
         lu.last_record_type,
         lu.last_job_sf_id
       FROM sf.part_last_used lu
       WHERE ${conditions.join(' AND ')}
       ORDER BY lu.last_job_date DESC NULLS LAST`,
      params,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No job history found for this part number' });
    }

    return res.json({
      partNumber,
      total:   result.rowCount,
      results: result.rows,
    });
  } catch (err) {
    console.error('[bom/parts/:partNumber/last-used] GET failed:', err);
    return res.status(500).json({ error: 'Last-used query failed' });
  } finally {
    await pool.end();
  }
});

// ─── POST /bom/sync ───────────────────────────────────────────────────────────
// Triggers incremental sync of Salesforce data. Runs sf_sync.py on the container.
router.post('/sync', requirePermission('SF_ANALYSIS_VIEW'), (req: Request, res: Response) => {
  const since = (req.body?.since as string | undefined) ?? '';
  const sinceArg = since ? `--since ${since}` : '';
  const mode = since ? 'incremental' : 'full';

  // Fire and forget — sync can take several minutes for full mode
  exec(
    `python3 /tmp/sf_sync.py --mode ${mode} ${sinceArg} 2>&1`,
    { timeout: 600_000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error('[bom/sync] Sync failed:', err.message, stderr);
      } else {
        console.log('[bom/sync] Sync complete:', stdout.slice(-500));
      }
    },
  );

  return res.json({ ok: true, mode, since: since || null, message: 'Sync started in background' });
});

export default router;
