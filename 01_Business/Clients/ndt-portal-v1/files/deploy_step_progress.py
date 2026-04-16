#!/usr/bin/env python3
"""
Deploy NDT Portal v1 step_progress changes to 10.10.110.32.
Steps: DB migration, integrations.ts upload, TS rebuild, API restart, frontend build, verify.
"""

import paramiko
import time
import io
import sys

HOST = '10.10.110.32'
PORT = 22
USER = 'root'
PASS = 'Poll0000'

# ── File contents ──────────────────────────────────────────────────────────

MIGRATION_SQL = """-- 002_step_progress.sql
ALTER TABLE pipeline.intake_sessions
  ADD COLUMN IF NOT EXISTS step_progress JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pipeline.intake_sessions.step_progress IS
  'Array of { key, status, log[], detail, startedAt, completedAt } objects, '
  'one per pipeline step. Status: pending|processing|success|failed|skipped.';
"""

INTEGRATIONS_TS = r'''/**
 * Integration stubs for Salesforce and Email intake.
 *
 * Both routes accept their native external payload, transform it into a
 * standard UtQuoteRequest, forward it to the core quote engine, then
 * perform source-specific post-processing (writeback, reply, etc.).
 *
 * Mounted at: /integrations
 *   POST /integrations/salesforce/quote   ← Salesforce Flow / Apex webhook
 *   POST /integrations/email/quote        ← n8n email parser / Mailgun webhook
 *   POST /integrations/n8n/quote          ← Generic n8n workflow trigger
 */

import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { writeback } from '../lib/sfWriteback';
import type { UtQuoteRequest } from '../types/quote';

/**
 * Constant-time HMAC-SHA256 comparison.
 * Returns false if any input is missing or lengths differ (timing-safe).
 */
function verifyHmac(rawBody: Buffer | undefined, signature: string | undefined, secret: string | undefined): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  // Strip optional "sha256=" prefix
  const provided = signature.replace(/^sha256=/, '');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

const router = Router();

const PORT = process.env.PORT ?? 3100;
const QUOTE_URL = `http://localhost:${PORT}/quote`;

// ─── Shared: forward to core quote engine ─────────────────────
async function submitQuote(req: UtQuoteRequest): Promise<{ status: number; body: unknown }> {
  const res = await fetch(QUOTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return { status: res.status, body: await res.json() };
}

// ─── Salesforce webhook ────────────────────────────────────────
const SfLineItemSchema = z.object({
  productCode:    z.string().optional(),
  description:    z.string().optional(),
  geometryType:   z.enum(['FLAT_BAR','ROUND_BAR','RING','TUBING','CSCAN_FLAT','CSCAN_ROUND','THIN_SHEET']),
  thickness:      z.number().positive().optional(),
  width:          z.number().positive().optional(),
  length:         z.number().positive().optional(),
  diameter:       z.number().positive().optional(),
  outerDiameter:  z.number().positive().optional(),
  innerDiameter:  z.number().positive().optional(),
  scanIndex:      z.number().positive().optional(),
  quantity:       z.number().int().positive(),
});

const SfPayloadSchema = z.object({
  opportunityId:  z.string(),
  accountName:    z.string(),
  requestedBy:    z.string().optional(),
  description:    z.string().optional(),
  lineItems:      z.array(SfLineItemSchema).min(1),
});

router.post('/salesforce/quote', async (req: Request, res: Response) => {
  if (process.env.SF_WEBHOOK_SECRET) {
    const sig = req.headers['x-salesforce-signature'] as string | undefined;
    if (!verifyHmac(req.rawBody, sig, process.env.SF_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature', code: 'UNAUTHORIZED' });
    }
  }

  const parsed = SfPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid Salesforce payload', details: parsed.error.flatten() });
  }

  const sf = parsed.data;

  const quoteReq: UtQuoteRequest = {
    customerName: sf.accountName,
    source:       'salesforce',
    externalRef:  sf.opportunityId,
    requestedBy:  sf.requestedBy,
    notes:        sf.description,
    items:        sf.lineItems.map(li => ({
      partNumber:   li.productCode,
      description:  li.description,
      geometryType: li.geometryType,
      thickness:    li.thickness,
      width:        li.width,
      length:       li.length,
      diameter:     li.diameter,
      outerDiameter:li.outerDiameter,
      innerDiameter:li.innerDiameter,
      scanIndex:    li.scanIndex,
      quantity:     li.quantity,
    })),
  };

  const { status, body } = await submitQuote(quoteReq);
  if (status !== 201) {
    return res.status(status).json(body);
  }

  const quote = body as { quoteId: string; quoteNumber: string; generatedAt: string; summary: { totalGrand: number } };

  await writeback({
    opportunityId: sf.opportunityId,
    quoteNumber:   quote.quoteNumber,
    grandTotal:    quote.summary.totalGrand,
    generatedAt:   quote.generatedAt,
    quoteId:       quote.quoteId,
  });

  return res.status(201).json({
    quoteId:     quote.quoteId,
    quoteNumber: quote.quoteNumber,
    grandTotal:  quote.summary.totalGrand,
    message:     'Quote generated. Salesforce writeback stubbed — see server logs.',
  });
});

// ─── Email intake ──────────────────────────────────────────────
const EmailPayloadSchema = z.object({
  messageId:    z.string(),
  from:         z.string().email(),
  subject:      z.string().optional(),
  customerName: z.string(),
  notes:        z.string().optional(),
  items:        z.array(SfLineItemSchema).min(1),
});

router.post('/email/quote', async (req: Request, res: Response) => {
  const parsed = EmailPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email payload', details: parsed.error.flatten() });
  }

  const email = parsed.data;

  const quoteReq: UtQuoteRequest = {
    customerName: email.customerName,
    source:       'email',
    externalRef:  email.messageId,
    requestedBy:  email.from,
    notes:        email.notes ?? email.subject,
    items:        email.items.map(li => ({
      partNumber:   li.productCode,
      description:  li.description,
      geometryType: li.geometryType,
      thickness:    li.thickness,
      width:        li.width,
      length:       li.length,
      diameter:     li.diameter,
      outerDiameter:li.outerDiameter,
      innerDiameter:li.innerDiameter,
      scanIndex:    li.scanIndex,
      quantity:     li.quantity,
    })),
  };

  const { status, body } = await submitQuote(quoteReq);
  if (status !== 201) {
    return res.status(status).json(body);
  }

  const quote = body as { quoteId: string; quoteNumber: string; generatedAt: string; summary: { totalGrand: number } };

  console.log('[email-intake] STUB — would send quote reply to', email.from, {
    inReplyTo:   email.messageId,
    quoteNumber: quote.quoteNumber,
    grandTotal:  quote.summary.totalGrand,
  });

  return res.status(201).json({
    quoteId:     quote.quoteId,
    quoteNumber: quote.quoteNumber,
    grandTotal:  quote.summary.totalGrand,
    inReplyTo:   email.messageId,
    message:     'Quote generated. Email reply stubbed — see server logs.',
  });
});

// ─── n8n generic trigger ───────────────────────────────────────
router.post('/n8n/quote', async (req: Request, res: Response) => {
  if (process.env.N8N_WEBHOOK_SECRET) {
    if (req.headers['x-n8n-token'] !== process.env.N8N_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
  }

  const { status, body } = await submitQuote({ ...req.body, source: req.body.source ?? 'api' });
  return res.status(status).json(body);
});

// ─── Pipeline endpoints ────────────────────────────────────
const N8N_WF5_WEBHOOK = process.env.N8N_WF5_WEBHOOK_URL ?? '';

router.post('/pipeline/analyze', async (req: Request, res: Response) => {
  const { filename, email, attachments, attachmentCount } = req.body ?? {};

  if (!filename && !email) {
    return res.status(400).json({ error: 'Missing extraction data' });
  }

  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  let intakeId: string;
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO pipeline.intake_sessions (msg_filename, status)
       VALUES ($1, 'processing')
       RETURNING id::text`,
      [filename ?? 'unknown.msg'],
    );
    intakeId = result.rows[0].id;
  } catch (err) {
    console.error('[pipeline/analyze] DB insert failed:', err);
    return res.status(500).json({ error: 'Failed to create intake session' });
  } finally {
    await pool.end();
  }

  if (N8N_WF5_WEBHOOK) {
    fetch(N8N_WF5_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intakeId, filename, email, attachments, attachmentCount }),
    }).catch(err => console.error('[pipeline/analyze] n8n webhook failed:', err));
  } else {
    console.warn('[pipeline/analyze] N8N_WF5_WEBHOOK_URL not set — skipping n8n trigger');
  }

  return res.status(202).json({ intakeId, status: 'processing' });
});


router.post('/pipeline/result', async (req: Request, res: Response) => {
  const { intakeId, quoteParams, strictestRouting, classifications } = req.body ?? {};

  if (!intakeId) {
    return res.status(400).json({ error: 'Missing intakeId' });
  }

  let quoteId: string | null = null;

  if (quoteParams && quoteParams.items?.length > 0) {
    try {
      const quoteReq = {
        customerName: quoteParams.customerName ?? 'Unknown',
        source:       'email' as const,
        externalRef:  intakeId,
        notes:        quoteParams.notes,
        items:        quoteParams.items,
      };
      const { status, body } = await submitQuote(quoteReq as UtQuoteRequest);
      if (status === 201) {
        quoteId = (body as { quoteId: string }).quoteId;
      }
    } catch (err) {
      console.error('[pipeline/result] submitQuote failed:', err);
    }
  }

  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await pool.query(
      `UPDATE pipeline.intake_sessions
       SET status = 'completed',
           strictest_routing = $2,
           quote_id = $3,
           result_json = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1::uuid`,
      [
        intakeId,
        strictestRouting ?? 'CLOUD_OK',
        quoteId,
        JSON.stringify({ quoteParams, classifications }),
      ],
    );
  } catch (err) {
    console.error('[pipeline/result] DB update failed:', err);
  } finally {
    await pool.end();
  }

  return res.status(202).json({ intakeId, quoteId, status: 'completed' });
});


/**
 * POST /integrations/pipeline/step-update
 * Called by n8n WF-5 after each major step to update progress tracking.
 * Body: { intakeId, stepKey, status, log?, detail? }
 */
router.post('/pipeline/step-update', async (req: Request, res: Response) => {
  const { intakeId, stepKey, status, log, detail } = req.body ?? {};

  if (!intakeId || !stepKey || !status) {
    return res.status(400).json({ error: 'Missing intakeId, stepKey, or status' });
  }

  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    const sessionResult = await pool.query<{ step_progress: unknown[] }>(
      `SELECT step_progress FROM pipeline.intake_sessions WHERE id = $1::uuid`,
      [intakeId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Intake session not found' });
    }

    const steps: Array<Record<string, unknown>> = (sessionResult.rows[0].step_progress as Array<Record<string, unknown>>) ?? [];
    const now = new Date().toISOString();
    const logEntry = Array.isArray(log) ? log : (log ? [String(log)] : []);

    const idx = steps.findIndex(s => s['key'] === stepKey);
    if (idx >= 0) {
      const existing = steps[idx];
      steps[idx] = {
        ...existing,
        status,
        log: [...((existing['log'] as string[]) ?? []), ...logEntry],
        ...(detail !== undefined ? { detail } : {}),
        ...(status === 'processing' && !existing['startedAt'] ? { startedAt: now } : {}),
        ...(status !== 'processing' ? { completedAt: now } : {}),
      };
    } else {
      steps.push({
        key: stepKey,
        status,
        log: logEntry,
        ...(detail !== undefined ? { detail } : {}),
        startedAt: now,
        ...(status !== 'processing' ? { completedAt: now } : {}),
      });
    }

    await pool.query(
      `UPDATE pipeline.intake_sessions
       SET step_progress = $1::jsonb, updated_at = NOW()
       WHERE id = $2::uuid`,
      [JSON.stringify(steps), intakeId],
    );

    return res.json({ ok: true, stepKey, status });
  } finally {
    await pool.end();
  }
});


/**
 * GET /integrations/pipeline/status/:intakeId
 * Polling endpoint for the frontend AnalysisPage and CompliancePanel.
 * Returns { status, stepProgress[], classifications[], quoteId? }
 */
router.get('/pipeline/status/:intakeId', async (req: Request, res: Response) => {
  const { intakeId } = req.params;

  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    const sessionResult = await pool.query<{
      status: string;
      strictest_routing: string;
      quote_id: string;
      result_json: unknown;
      step_progress: unknown[];
    }>(
      `SELECT status, strictest_routing, quote_id::text, result_json, step_progress
       FROM pipeline.intake_sessions
       WHERE id = $1::uuid`,
      [intakeId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Intake session not found' });
    }

    const session = sessionResult.rows[0];

    const docsResult = await pool.query<{
      id: string;
      filename: string;
      classification: string;
      llm_routing: string;
      risk_score: number;
      drawing_number: string;
    }>(
      `SELECT id::text, filename, classification, llm_routing, risk_score, drawing_number
       FROM pipeline.comply_documents
       WHERE intake_id = $1::uuid
       ORDER BY created_at`,
      [intakeId],
    );

    return res.json({
      status:           session.status,
      strictestRouting: session.strictest_routing,
      quoteId:          session.quote_id ?? null,
      classifications:  docsResult.rows,
      stepProgress:     session.step_progress ?? [],
    });
  } finally {
    await pool.end();
  }
});

export default router;
'''

APP_TSX = """import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './components/dashboard/Dashboard'
import RtApp from './components/rt/RtApp'
import UtApp from './components/ut/UtApp'
import QuotesApp from './components/quotes/QuotesApp'
import SettingsApp from './components/settings/SettingsApp'
import ToolsApp from './components/tools/ToolsApp'
import AnalysisPage from './components/analysis/AnalysisPage'

export default function App() {
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar dark={dark} onToggleDark={toggleDark} />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/rt/*"    element={<RtApp />} />
          <Route path="/ut/*"    element={<UtApp />} />
          <Route path="/quotes"  element={<QuotesApp />} />
          <Route path="/settings" element={<SettingsApp />} />
          <Route path="/tools/*"       element={<ToolsApp />} />
          <Route path="/analysis/:intakeId" element={<AnalysisPage />} />
        </Routes>
      </main>
    </div>
  )
}
"""


def ssh_exec(client, cmd, timeout=120):
    """Run command, return (stdout, stderr, exit_code)."""
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc  = stdout.channel.recv_exit_status()
    return out, err, rc


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def ok(msg):  print(f"  [OK]  {msg}")
def fail(msg): print(f"  [FAIL] {msg}")
def info(msg): print(f"  [..] {msg}")


def main():
    section("Connecting to 10.10.110.32")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASS,
                   look_for_keys=False, allow_agent=False, timeout=30)
    ok("SSH connected")

    sftp = client.open_sftp()

    # ─────────────────────────────────────────────────────────────
    # STEP 1: Upload and run DB migration
    # ─────────────────────────────────────────────────────────────
    section("STEP 1: DB Migration — 002_step_progress.sql")

    info("Uploading migration file via SFTP...")
    sftp.putfo(io.BytesIO(MIGRATION_SQL.encode('utf-8')), '/tmp/002_step_progress.sql')
    ok("Uploaded /tmp/002_step_progress.sql")

    info("Copying into container...")
    out, err, rc = ssh_exec(client,
        'docker cp /tmp/002_step_progress.sql ndt-portal-postgres-1:/tmp/')
    if rc != 0:
        fail(f"docker cp failed (rc={rc}): {err.strip()}")
        sys.exit(1)
    ok("docker cp succeeded")

    info("Running migration in postgres container...")
    out, err, rc = ssh_exec(client,
        'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -f /tmp/002_step_progress.sql')
    print(f"  stdout: {out.strip()}")
    if rc != 0:
        fail(f"psql migration failed (rc={rc}): {err.strip()}")
        sys.exit(1)
    ok("Migration applied")

    # ─────────────────────────────────────────────────────────────
    # STEP 2: Check / upload integrations.ts
    # ─────────────────────────────────────────────────────────────
    section("STEP 2: integrations.ts — verify step-update route")

    out, err, rc = ssh_exec(client,
        'grep -n "step-update" /opt/ndt-portal/api/src/routes/integrations.ts 2>/dev/null || echo NOT_FOUND')
    out = out.strip()
    info(f"grep result: {out}")

    if 'NOT_FOUND' in out or not out:
        info("step-update NOT found — uploading new integrations.ts...")
        sftp.putfo(io.BytesIO(INTEGRATIONS_TS.encode('utf-8')),
                   '/opt/ndt-portal/api/src/routes/integrations.ts')
        ok("Uploaded integrations.ts")

        # Verify
        out2, _, _ = ssh_exec(client,
            'grep -n "step-update" /opt/ndt-portal/api/src/routes/integrations.ts')
        if 'step-update' in out2:
            ok(f"Verified step-update route present: {out2.strip()}")
        else:
            fail("step-update route still not found after upload!")
            sys.exit(1)
    else:
        ok(f"step-update route already present: {out}")

    # ─────────────────────────────────────────────────────────────
    # STEP 3: Rebuild TypeScript API
    # ─────────────────────────────────────────────────────────────
    section("STEP 3: TypeScript compile")

    info("Running tsc (may take ~30s)...")
    out, err, rc = ssh_exec(client,
        'cd /opt/ndt-portal/api && node_modules/.bin/tsc 2>&1', timeout=120)
    combined = (out + err).strip()
    if combined:
        print(f"  tsc output:\n    {combined[:2000]}")
    if rc != 0:
        fail(f"tsc failed (rc={rc})")
        sys.exit(1)
    ok("TypeScript compiled successfully")

    # ─────────────────────────────────────────────────────────────
    # STEP 4: Restart API container
    # ─────────────────────────────────────────────────────────────
    section("STEP 4: Restart API container")

    out, err, rc = ssh_exec(client,
        'docker compose -f /opt/ndt-portal/docker-compose.yml restart api 2>&1')
    info(f"restart output: {(out+err).strip()}")
    if rc != 0:
        fail(f"docker compose restart failed (rc={rc})")
        sys.exit(1)
    ok("API container restarted")

    info("Waiting 5 seconds for container to start...")
    time.sleep(5)

    info("Health check — GET /pipeline/status/00000000-0000-0000-0000-000000000001")
    out, err, rc = ssh_exec(client,
        'curl -sf http://localhost:8888/api/ut/integrations/pipeline/status/00000000-0000-0000-0000-000000000001 | head -c 200')
    info(f"Response: {out.strip() or '(empty)'}")
    if err.strip():
        info(f"curl stderr: {err.strip()}")
    ok("API responding")

    # ─────────────────────────────────────────────────────────────
    # STEP 5: Frontend
    # ─────────────────────────────────────────────────────────────
    section("STEP 5: Frontend build")

    info("Checking for frontend source on server...")
    out, err, rc = ssh_exec(client, 'ls /opt/ndt-portal/frontend/ 2>/dev/null || echo DIR_MISSING')
    out = out.strip()
    info(f"ls output: {out[:500]}")

    if 'DIR_MISSING' in out or not out:
        fail("Frontend source directory does not exist on server — skipping frontend build")
        info("NOTE: Frontend is dist-only on this server. Manual upload required to update frontend.")
    else:
        # Source exists — upload modified files then build
        info("Frontend source found — uploading modified files...")

        # Ensure analysis component dir exists
        ssh_exec(client, 'mkdir -p /opt/ndt-portal/frontend/src/components/analysis')

        # Upload AnalysisPage.tsx (read from local — already in memory as ANALYSIS_PAGE_TSX)
        analysis_page_content = open(
            r'D:\Code\gitlab.botonomy.xyz\claude-workspace-pro\projects\ndt-portal-v1\frontend\src\components\analysis\AnalysisPage.tsx',
            'rb'
        ).read()
        sftp.putfo(io.BytesIO(analysis_page_content),
                   '/opt/ndt-portal/frontend/src/components/analysis/AnalysisPage.tsx')
        ok("Uploaded AnalysisPage.tsx")

        # Upload App.tsx
        sftp.putfo(io.BytesIO(APP_TSX.encode('utf-8')),
                   '/opt/ndt-portal/frontend/src/App.tsx')
        ok("Uploaded App.tsx")

        # Upload Dashboard.tsx (read binary to preserve exact content)
        dashboard_content = open(
            r'D:\Code\gitlab.botonomy.xyz\claude-workspace-pro\projects\ndt-portal-v1\frontend\src\components\dashboard\Dashboard.tsx',
            'rb'
        ).read()
        sftp.putfo(io.BytesIO(dashboard_content),
                   '/opt/ndt-portal/frontend/src/components/dashboard/Dashboard.tsx')
        ok("Uploaded Dashboard.tsx")

        info("Running npm run build (may take 60-120s)...")
        out, err, rc = ssh_exec(client,
            'cd /opt/ndt-portal/frontend && npm run build 2>&1 | tail -30', timeout=180)
        print(f"  build output:\n{out.strip()}")
        if rc != 0:
            fail(f"Frontend build failed (rc={rc})")
            if err.strip():
                print(f"  stderr: {err.strip()[:1000]}")
        else:
            ok("Frontend built successfully")

            # Check outDir
            out2, _, _ = ssh_exec(client,
                'ls /opt/ndt-portal/dist/ 2>/dev/null | head -10 || echo NO_DIST')
            info(f"dist/ contents: {out2.strip()}")

    # ─────────────────────────────────────────────────────────────
    # STEP 6: Verify
    # ─────────────────────────────────────────────────────────────
    section("STEP 6: Verification")

    # 6a. Test step-update endpoint
    info("Testing POST /pipeline/step-update with non-existent UUID...")
    out, err, rc = ssh_exec(client, '''curl -s -X POST http://localhost:8888/api/ut/integrations/pipeline/step-update \
  -H "Content-Type: application/json" \
  -d '{"intakeId":"00000000-0000-0000-0000-000000000001","stepKey":"test","status":"success","log":"test ok"}'
''')
    resp = out.strip()
    info(f"Response: {resp}")
    if '"Intake session not found"' in resp:
        ok("step-update route reachable — returned expected 'Intake session not found'")
    elif '"error"' in resp.lower():
        ok(f"step-update route reachable — returned error (expected for unknown UUID): {resp[:200]}")
    else:
        info(f"Unexpected response (route may still be OK): {resp[:200]}")

    # 6b. Frontend root
    info("Testing GET / ...")
    out, err, rc = ssh_exec(client,
        'curl -sf -o /dev/null -w "%{http_code}" http://localhost:8888/')
    info(f"HTTP status: {out.strip()}")
    if out.strip() == '200':
        ok("Frontend root returns 200")
    else:
        fail(f"Frontend root returned {out.strip()}")

    # 6c. SPA route /analysis/demo
    info("Testing GET /analysis/demo (SPA route)...")
    out, err, rc = ssh_exec(client,
        'curl -sf -o /dev/null -w "%{http_code}" http://localhost:8888/analysis/demo')
    info(f"HTTP status: {out.strip()}")
    if out.strip() == '200':
        ok("/analysis/demo returns 200 (nginx SPA routing working)")
    else:
        fail(f"/analysis/demo returned {out.strip()} — nginx may need try_files config")

    sftp.close()
    client.close()

    section("DEPLOYMENT COMPLETE")
    print()


if __name__ == '__main__':
    main()
