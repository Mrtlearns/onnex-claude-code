/**
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
/**
 * Called by a Salesforce Flow or Apex trigger when an Opportunity
 * reaches the "Quote Requested" stage.
 *
 * Expected payload (maps to Salesforce Opportunity + Line Items):
 * {
 *   opportunityId:  "0065g00000AbCdEf",
 *   accountName:    "PREMCO",
 *   requestedBy:    "sales@onnex.com",
 *   description:    "Optional notes from Opportunity.Description",
 *   lineItems: [{
 *     productCode:   "AM-001",
 *     geometryType:  "FLAT_BAR",
 *     thickness:     3.625,
 *     width:         11.625,
 *     length:        15.75,
 *     quantity:      200
 *   }]
 * }
 *
 * TODO: Add HMAC signature verification using SF_WEBHOOK_SECRET env var:
 *   const sig = req.headers['x-salesforce-signature']
 *   if (!verifyHmac(req.rawBody, sig, process.env.SF_WEBHOOK_SECRET)) return 401
 */
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

  // Map Salesforce payload → standard UtQuoteRequest
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

  // TODO: Salesforce writeback — uncomment when SF credentials are configured
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
/**
 * Called by n8n (or Mailgun/SendGrid webhook) after parsing an inbound
 * quote-request email.
 *
 * Expected payload:
 * {
 *   messageId:    "<unique-message-id@mail.example.com>",
 *   from:         "buyer@premco.com",
 *   subject:      "Quote Request - Flat Bars",
 *   customerName: "PREMCO",          ← parsed from subject or body
 *   notes:        "Full email body text for reference",
 *   items: [{
 *     geometryType: "FLAT_BAR",
 *     thickness:    3.625,
 *     width:        11.625,
 *     length:       15.75,
 *     quantity:     200
 *   }]
 * }
 *
 * TODO: Add email reply-back when status moves to 'sent':
 *   - Store messageId in externalRef
 *   - Use Mailgun/SendGrid API to send reply referencing Message-ID
 *   - n8n can poll /quote?status=eq.pending and trigger the send
 */
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

  // Map email payload → standard UtQuoteRequest
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

  // TODO: Send quote reply email
  // The messageId is stored as externalRef in the quote record, enabling
  // the reply to thread correctly in the customer's email client.
  // Implement via Mailgun/SendGrid SDK or n8n webhook callback.
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
/**
 * Generic n8n webhook endpoint. Accepts a pre-formed UtQuoteRequest
 * directly — no transformation needed. n8n workflow handles the
 * mapping from whatever source (spreadsheet upload, form, etc.).
 *
 * n8n HTTP Request node config:
 *   Method: POST
 *   URL:    https://ndt-v1.on-nex.us/api/ut/integrations/n8n/quote
 *   Auth:   Header — X-N8N-Token: <shared secret>
 *   Body:   { "source": "api", "customerName": "...", "items": [...] }
 *
 * TODO: Validate X-N8N-Token against N8N_WEBHOOK_SECRET env var
 */
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
/**
 * POST /integrations/pipeline/analyze
 * Receives the MsgExtractResult from frontend after .msg upload.
 * Creates an intake_session, fires n8n WF-5, returns { intakeId, status }.
 *
 * Body: { filename, email, attachments, attachmentCount }
 */
const N8N_WF5_WEBHOOK = process.env.N8N_WF5_WEBHOOK_URL ?? '';

router.post('/pipeline/analyze', async (req: Request, res: Response) => {
  const { filename, email, attachments, attachmentCount } = req.body ?? {};

  if (!filename && !email) {
    return res.status(400).json({ error: 'Missing extraction data' });
  }

  // Create intake session
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
      `INSERT INTO pipeline.intake_sessions (msg_filename, status, email_from)
       VALUES ($1, 'processing', $2)
       RETURNING id::text`,
      [filename ?? 'unknown.msg', email?.from ?? null],
    );
    intakeId = result.rows[0].id;
  } catch (err) {
    console.error('[pipeline/analyze] DB insert failed:', err);
    return res.status(500).json({ error: 'Failed to create intake session' });
  } finally {
    await pool.end();
  }

  // Rewrite attachment downloadUrls to Docker-internal address so n8n can reach msg-api
  const MSG_API_INTERNAL = process.env.MSG_API_INTERNAL_URL ?? 'http://msg-api:8000';
  const n8nAttachments = Array.isArray(attachments)
    ? attachments.map((att: { downloadUrl?: string; [k: string]: unknown }) => {
        if (!att.downloadUrl) return att;
        // downloadUrl from frontend is relative: /api/msg/api/download/{folder}/{filename}
        // Strip the /api/msg Traefik prefix and replace with internal base
        const internalUrl = att.downloadUrl.replace(/^\/api\/msg/, '');
        return { ...att, downloadUrl: `${MSG_API_INTERNAL}${internalUrl}` };
      })
    : attachments;

  // Fire n8n WF-5 webhook (non-blocking)
  if (N8N_WF5_WEBHOOK) {
    fetch(N8N_WF5_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intakeId, filename, email, attachments: n8nAttachments, attachmentCount }),
    }).catch(err => console.error('[pipeline/analyze] n8n webhook failed:', err));
  } else {
    console.warn('[pipeline/analyze] N8N_WF5_WEBHOOK_URL not set — skipping n8n trigger');
  }

  return res.status(202).json({ intakeId, status: 'processing' });
});


/**
 * POST /integrations/pipeline/result
 * Called by n8n WF-5 when processing completes.
 * Receives final quote params, submits the quote, updates intake session.
 *
 * Body: { intakeId, quoteParams, strictestRouting, classifications[] }
 */
router.post('/pipeline/result', async (req: Request, res: Response) => {
  const { intakeId, quoteParams, strictestRouting, classifications, rtQuoteId } = req.body ?? {};

  if (!intakeId) {
    return res.status(400).json({ error: 'Missing intakeId' });
  }

  let quoteId: string | null = null;

  // Submit quote if params provided
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

  // Update intake session
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
           rt_quote_id = $4,
           result_json = $5::jsonb,
           updated_at = NOW()
       WHERE id = $1::uuid`,
      [
        intakeId,
        strictestRouting ?? 'CLOUD_OK',
        quoteId,
        rtQuoteId ?? null,
        JSON.stringify({ quoteParams, classifications }),
      ],
    );

    // Link intake_id back onto the quote row
    if (quoteId) {
      await pool.query(
        `UPDATE ut.incoming_quotes SET intake_id = $1 WHERE id = $2`,
        [intakeId, quoteId],
      );
    }
  } catch (err) {
    console.error('[pipeline/result] DB update failed:', err);
  } finally {
    await pool.end();
  }

  // Always post quote_created step to complete 11/11 pipeline steps
  const STEP_UPDATE_URL = `http://localhost:${PORT}/integrations/pipeline/step-update`;
  const quoteCreatedPayload = quoteId
    ? { intakeId, stepKey: 'quote_created', status: 'success',
        log: `UT quote created · ${quoteId}`, detail: { quoteId } }
    : rtQuoteId
    ? { intakeId, stepKey: 'quote_created', status: 'success',
        log: `RT quote created · ${rtQuoteId}`, detail: { rtQuoteId } }
    : { intakeId, stepKey: 'quote_created', status: 'skipped',
        log: 'No line items extracted — manual quote required' };
  fetch(STEP_UPDATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteCreatedPayload),
  }).catch(err => console.error('[pipeline/result] quote_created step-update failed:', err));

  return res.status(202).json({ intakeId, quoteId, rtQuoteId: rtQuoteId ?? null, status: 'completed' });
});


/**
 * POST /integrations/pipeline/step-update
 * Called by n8n WF-5 after each major step to update progress tracking.
 *
 * Core fields: { intakeId, stepKey, status, log?, detail? }
 *
 * Optional audit fields (added to step_events if present):
 *   eventType?:       'start'|'request_sent'|'response_received'|'complete'|'error'|'skip'
 *   direction?:       'out'|'in'|'internal'
 *   serviceName?:     string   — 'comply'|'sanitize'|'gateway'|'api'
 *   endpoint?:        string   — e.g. 'http://gateway:8012/analyze'
 *   httpStatus?:      number
 *   latencyMs?:       number
 *   requestPayload?:  object   — what was sent OUT to the service (tokenized, no plaintext)
 *   responsePayload?: object   — what came back IN (tokenized, no plaintext)
 *
 * Backward compatible — calls without new fields continue working unchanged.
 */
router.post('/pipeline/step-update', async (req: Request, res: Response) => {
  const {
    intakeId, stepKey, status, log, detail,
    eventType, direction, serviceName, endpoint, httpStatus, latencyMs,
    requestPayload, responsePayload,
  } = req.body ?? {};

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

    // ── Append audit events into step_events ────────────────────────────────
    // Insert up to two rows: one for outbound request, one for inbound response.
    // If neither payload is present, insert a single status-only event.
    const logMessage = Array.isArray(log) ? log[log.length - 1] ?? null : (log ?? null);
    const detailJson = detail !== undefined ? JSON.stringify(detail) : null;

    try {
      if (requestPayload) {
        await pool.query(
          `INSERT INTO pipeline.step_events
             (intake_id, step_key, event_type, direction, service_name, endpoint, log_message, payload, detail)
           VALUES ($1::uuid, $2, 'request_sent', 'out', $3, $4, $5, $6::jsonb, $7::jsonb)`,
          [intakeId, stepKey, serviceName ?? null, endpoint ?? null, logMessage,
           JSON.stringify(requestPayload), detailJson],
        );
      }

      if (responsePayload) {
        await pool.query(
          `INSERT INTO pipeline.step_events
             (intake_id, step_key, event_type, direction, service_name, endpoint,
              http_status, latency_ms, log_message, payload, detail)
           VALUES ($1::uuid, $2, 'response_received', 'in', $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`,
          [intakeId, stepKey, serviceName ?? null, endpoint ?? null,
           httpStatus ?? null, latencyMs ?? null, logMessage,
           JSON.stringify(responsePayload), detailJson],
        );
      }

      if (!requestPayload && !responsePayload) {
        const STATUS_TO_EVENT: Record<string, string> = {
          processing: 'start', success: 'complete', failed: 'error', skipped: 'skip',
        };
        const evtType = (eventType as string) ?? STATUS_TO_EVENT[status as string] ?? 'start';
        await pool.query(
          `INSERT INTO pipeline.step_events
             (intake_id, step_key, event_type, direction, service_name, endpoint,
              http_status, latency_ms, log_message, detail)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
          [intakeId, stepKey, evtType, (direction as string) ?? 'internal',
           serviceName ?? null, endpoint ?? null,
           httpStatus ?? null, latencyMs ?? null, logMessage, detailJson],
        );
      }
    } catch (auditErr) {
      // Non-fatal — step_progress update already succeeded; log and continue
      console.warn('[pipeline/step-update] step_events insert failed (table may not exist yet):', auditErr);
    }

    return res.json({ ok: true, stepKey, status });
  } finally {
    await pool.end();
  }
});


/**
 * POST /integrations/pipeline/history-lookup
 * Called by WF-5 "Retrieve History" node after email LLM extraction.
 * Queries SF-synced tables for part history, account context, and prior intakes.
 *
 * Body: { intakeId, emailFrom, partNumber }
 */
router.post('/pipeline/history-lookup', async (req: Request, res: Response) => {
  const { intakeId, emailFrom, partNumber } = req.body ?? {};

  if (!intakeId) {
    return res.status(400).json({ error: 'Missing intakeId' });
  }

  const emailDomain = (emailFrom ?? '').split('@')[1] ?? '';
  const domainKeyword = emailDomain.split('.')[0] ?? '';
  const skipPartQueries = !partNumber || partNumber === 'N/A';

  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    // Side effect: ensure email_from is stored on the session
    if (emailFrom) {
      await pool.query(
        `UPDATE pipeline.intake_sessions SET email_from = $2 WHERE id = $1::uuid`,
        [intakeId, emailFrom],
      ).catch(() => { /* non-fatal */ });
    }

    // Query A — BOM parts aggregated view
    let bom: Record<string, unknown> | null = null;
    if (!skipPartQueries) {
      try {
        const bomResult = await pool.query(
          `SELECT part_number, specifications, procedures, avg_invoice, max_invoice, job_count
           FROM sf.bom_parts
           WHERE part_number ILIKE $1
           LIMIT 1`,
          [partNumber],
        );
        if (bomResult.rows.length > 0) {
          bom = bomResult.rows[0];
        }
      } catch (_) { /* non-fatal */ }
    }

    // Query B — Recent job history
    let jobs: unknown[] = [];
    if (!skipPartQueries) {
      try {
        const jobsResult = await pool.query(
          `SELECT j.specification, j.ndt_procedure, j.acceptance_criteria,
                  j.invoice_amount, j.price_per_basis, j.services,
                  j.date_completed, j.work_order_number,
                  a.name AS account_name, a.payment_terms
           FROM sf.jobs j
           LEFT JOIN sf.accounts a ON a.name = j.account_name
           WHERE j.part_number ILIKE $1
           ORDER BY j.date_completed DESC NULLS LAST
           LIMIT 10`,
          [partNumber],
        );
        jobs = jobsResult.rows;
      } catch (_) { /* non-fatal */ }
    }

    // Query C — Quote history
    let quotes: unknown[] = [];
    if (!skipPartQueries) {
      try {
        const quotesResult = await pool.query(
          `SELECT quote_number, grand_total, pricing_basis, services_included, status, created_date
           FROM sf.quotes
           WHERE part_numbers ILIKE $1
           ORDER BY created_date DESC NULLS LAST
           LIMIT 5`,
          [`%${partNumber}%`],
        );
        quotes = quotesResult.rows;
      } catch (_) { /* non-fatal */ }
    }

    // Query D — Account context by domain keyword
    let accounts: unknown[] = [];
    if (domainKeyword) {
      try {
        const acctResult = await pool.query(
          `SELECT name, payment_terms, rate_sheet_ver, ytd_total
           FROM sf.accounts
           WHERE name ILIKE $1
           ORDER BY ytd_total DESC NULLS LAST
           LIMIT 3`,
          [`%${domainKeyword}%`],
        );
        accounts = acctResult.rows;
      } catch (_) { /* non-fatal */ }
    }

    // Query E — Prior intake sessions from same sender
    let priorSessions: unknown[] = [];
    try {
      const priorResult = await pool.query(
        `SELECT id::text, msg_filename, status, created_at
         FROM pipeline.intake_sessions
         WHERE (email_from = $1 OR email_from ILIKE $2)
           AND id != $3::uuid
         ORDER BY created_at DESC
         LIMIT 5`,
        [emailFrom ?? '', `%@${emailDomain}`, intakeId],
      );
      priorSessions = priorResult.rows;
    } catch (_) { /* non-fatal */ }

    const partFound = bom !== null || jobs.length > 0;
    const isNewClient = accounts.length === 0 && priorSessions.length === 0;

    const avgInvoice = bom ? Number((bom as Record<string, unknown>)['avg_invoice'] ?? 0) : 0;
    const acctNames = (accounts as Array<{ name: string }>).map(a => a.name).join(', ');
    const summary = partFound
      ? `${(bom as Record<string, unknown>)?.['job_count'] ?? jobs.length} jobs for ${partNumber} · spec: ${(jobs[0] as Record<string, unknown>)?.['specification'] ?? 'N/A'} · avg: $${avgInvoice.toFixed(2)}${acctNames ? ` · account: ${acctNames}` : ''} · prior intakes: ${priorSessions.length}`
      : isNewClient
        ? `No history found for ${partNumber || 'part'} · new client`
        : `No part history · ${priorSessions.length} prior intake(s) from this sender`;

    return res.json({
      partHistory: {
        found: partFound,
        partNumber: partNumber ?? null,
        bom,
        jobs,
        quotes,
      },
      accountContext: {
        matchedBy: 'domain_keyword',
        domainKeyword,
        accounts,
      },
      priorIntakes: {
        count: priorSessions.length,
        sessions: priorSessions,
      },
      isNewClient,
      summary,
    });
  } finally {
    await pool.end();
  }
});


/**
 * GET /integrations/pipeline/logs/:quoteId
 * Returns the intake session linked to a quote, for the Pipeline Log button.
 * Returns { intakeId, status, stepProgress, createdAt }
 */
router.get('/pipeline/logs/:quoteId', async (req: Request, res: Response) => {
  const { quoteId } = req.params;

  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    const result = await pool.query<{
      id: string;
      status: string;
      step_progress: unknown[];
      created_at: string;
    }>(
      `SELECT id::text, status, step_progress, created_at
       FROM pipeline.intake_sessions
       WHERE quote_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 1`,
      [quoteId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pipeline log found for this quote' });
    }

    const row = result.rows[0];
    return res.json({
      intakeId:     row.id,
      status:       row.status,
      stepProgress: row.step_progress ?? [],
      createdAt:    row.created_at,
    });
  } finally {
    await pool.end();
  }
});


/**
 * GET /integrations/pipeline/audit/:intakeId
 * Full audit log for the ExecutionLogViewer component.
 * Returns intake session header + all step_events in chronological order.
 */
router.get('/pipeline/audit/:intakeId', async (req: Request, res: Response) => {
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
      id: string;
      status: string;
      msg_filename: string;
      step_progress: unknown[];
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id::text, status, msg_filename, step_progress, created_at, updated_at
       FROM pipeline.intake_sessions
       WHERE id = $1::uuid`,
      [intakeId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Intake session not found' });
    }

    const eventsResult = await pool.query(
      `SELECT id::text, intake_id::text, step_key, event_type, direction, service_name,
              endpoint, http_status, latency_ms, payload, log_message, detail, created_at
       FROM pipeline.step_events
       WHERE intake_id = $1::uuid
       ORDER BY created_at ASC`,
      [intakeId],
    );

    const session = sessionResult.rows[0];
    return res.json({
      intake: {
        intakeId:     session.id,
        status:       session.status,
        msgFilename:  session.msg_filename,
        createdAt:    session.created_at,
        updatedAt:    session.updated_at,
        stepProgress: session.step_progress ?? [],
      },
      events: eventsResult.rows.map((r: Record<string, unknown>) => ({
        id:          r['id'],
        intakeId:    r['intake_id'],
        stepKey:     r['step_key'],
        eventType:   r['event_type'],
        direction:   r['direction'],
        serviceName: r['service_name'],
        endpoint:    r['endpoint'],
        httpStatus:  r['http_status'],
        latencyMs:   r['latency_ms'],
        payload:     r['payload'],
        logMessage:  r['log_message'],
        detail:      r['detail'],
        createdAt:   r['created_at'],
      })),
      eventCount: eventsResult.rows.length,
    });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '22P02') {
      return res.status(404).json({ error: 'Intake session not found' });
    }
    console.error('[pipeline/audit] query error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});


/**
 * GET /integrations/pipeline/status/:intakeId
 * Polling endpoint for the frontend AnalysisPage and CompliancePanel.
 * Returns { status, stepProgress[], classifications[], quoteId? }
 * Computes 'stalled' overlay when session has been processing too long
 * (does NOT write to intake_sessions.status — stall is computed only).
 */
const STEP_STALL_MS    = 5  * 60 * 1000;   // 5 min without an update
const SESSION_STALL_MS = 15 * 60 * 1000;   // 15 min total session age

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
    // Intake session — include timestamps for stall detection
    const sessionResult = await pool.query<{
      status: string;
      strictest_routing: string;
      quote_id: string;
      rt_quote_id: string;
      result_json: unknown;
      step_progress: unknown[];
      created_at: string;
      updated_at: string;
    }>(
      `SELECT status, strictest_routing, quote_id::text, rt_quote_id::text, result_json, step_progress,
              created_at, updated_at
       FROM pipeline.intake_sessions
       WHERE id = $1::uuid`,
      [intakeId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Intake session not found' });
    }

    const session = sessionResult.rows[0];

    // ── Stall detection (computed overlay — does not modify DB status) ───────
    let effectiveStatus = session.status;
    if (session.status === 'processing') {
      const lastUpdate = Date.now() - new Date(session.updated_at).getTime();
      const sessionAge  = Date.now() - new Date(session.created_at).getTime();
      if (lastUpdate > STEP_STALL_MS || sessionAge > SESSION_STALL_MS) {
        effectiveStatus = 'stalled';
        // Insert a stalled event (idempotent — skip if one already exists)
        try {
          await pool.query(
            `INSERT INTO pipeline.step_events
               (intake_id, step_key, event_type, direction, log_message)
             SELECT $1::uuid, 'pipeline', 'stalled', 'internal',
                    'Pipeline stalled — no activity detected'
             WHERE NOT EXISTS (
               SELECT 1 FROM pipeline.step_events
               WHERE intake_id = $1::uuid AND event_type = 'stalled'
             )`,
            [intakeId],
          );
        } catch (_) {
          // Non-fatal — step_events table may not exist in older deploys
        }
      }
    }

    // Per-attachment classifications
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
      status:           effectiveStatus,
      strictestRouting: session.strictest_routing,
      quoteId:          session.quote_id ?? null,
      rtQuoteId:        session.rt_quote_id ?? null,
      classifications:  docsResult.rows,
      stepProgress:     session.step_progress ?? [],
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /integrations/pipeline/sessions
 * Returns recent intake sessions for E2E test discovery (latest 50, newest first).
 * Fields are camelCase to match the audit endpoint convention.
 */
router.get('/pipeline/sessions', async (_req: Request, res: Response) => {
  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });
  try {
    const result = await pool.query(
      `SELECT id::text, status, msg_filename, created_at, updated_at
       FROM pipeline.intake_sessions
       ORDER BY created_at DESC
       LIMIT 50`
    );
    return res.json(result.rows.map(r => ({
      intakeId:    r['id'],
      status:      r['status'],
      msgFilename: r['msg_filename'],
      createdAt:   r['created_at'],
      updatedAt:   r['updated_at'],
    })));
  } catch (err) {
    console.error('[pipeline/sessions] query error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ─── Email Inbox (on-demand via n8n WF-6) ─────────────────────
/**
 * GET /integrations/email/inbox
 * Triggers n8n WF-6 webhook to fetch unread Gmail messages.
 * Returns array of email summaries for the user to select from.
 */
const N8N_EMAIL_CHECK_URL = process.env.N8N_EMAIL_CHECK_URL ?? 'http://n8n:5678/webhook/ndt-email-check';

router.get('/email/inbox', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(N8N_EMAIL_CHECK_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('[email/inbox] n8n webhook error:', response.status, await response.text());
      return res.status(502).json({ error: 'Failed to fetch emails from n8n', emails: [] });
    }

    const raw = await response.json() as unknown[];
    // n8n Gmail node with simple:false returns structured objects.
    // `from` is an object { value: [{address, name}], text: string }
    // `text` is the decoded plain-text body. `date` is ISO string.

    function resolveFrom(from: unknown): string {
      if (typeof from === 'string') return from;
      if (from && typeof from === 'object') {
        const f = from as Record<string, unknown>;
        // Prefer .text which n8n formats as "Name <email>"
        if (typeof f['text'] === 'string') return f['text'] as string;
        const values = f['value'] as Array<{ name?: string; address?: string }> | undefined;
        if (Array.isArray(values) && values[0]) {
          const v = values[0];
          return v.name ? `${v.name} <${v.address}>` : (v.address ?? '');
        }
      }
      return '';
    }

    // Automated categories to exclude (Gmail API label IDs)
    const EXCLUDED_CATEGORIES = new Set([
      'CATEGORY_UPDATES',
      'CATEGORY_PROMOTIONS',
      'CATEGORY_SOCIAL',
      'CATEGORY_FORUMS',
    ]);

    const emails = (Array.isArray(raw) ? raw : [])
      .filter((item: unknown) => {
        const it = item as Record<string, unknown>;
        const labelIds = it['labelIds'] as string[] | undefined;
        if (!Array.isArray(labelIds)) return true; // no label info — include
        return !labelIds.some(l => EXCLUDED_CATEGORIES.has(l));
      })
      .map((item: unknown) => {
        const it = item as Record<string, unknown>;
        return {
          id:       (it['id'] as string) ?? '',
          threadId: (it['threadId'] as string) ?? '',
          subject:  (it['subject'] as string) ?? (it['Subject'] as string) ?? '(no subject)',
          from:     resolveFrom(it['from'] ?? it['From']),
          to:       resolveFrom(it['to'] ?? it['To']),
          date:     (it['date'] as string) ?? '',
          snippet:  (it['snippet'] as string) ?? '',
          body:     (it['text'] as string) ?? (it['body'] as string) ?? '',
        };
      });

    return res.json({ emails, count: emails.length });
  } catch (err) {
    console.error('[email/inbox] fetch error:', err);
    return res.status(502).json({ error: 'Could not reach n8n email checker', emails: [] });
  }
});

// ─── Email Classification ──────────────────────────────────────
/**
 * POST /integrations/email/classify
 * Takes a selected email's text body and uses the LLM gateway to
 * classify what inspection type(s) are being requested.
 *
 * Body: { subject, from, body, snippet }
 * Returns: { inspectionTypes: string[], confidence: string, notes: string }
 */
const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://ndtv1-gateway:8080';

const INSPECTION_TYPES = ['RT', 'UT', 'ET', 'MT', 'PT', 'VT'] as const;

const classifySystemPrompt = `You are an NDT (Non-Destructive Testing) inspection request classifier.
Your job is to read an email and determine which NDT inspection method(s) are being requested.

NDT Methods:
- RT: Radiographic Testing (X-ray, gamma-ray imaging of internal structure)
- UT: Ultrasonic Testing (high-frequency sound waves to detect flaws)
- ET: Eddy Current Testing (electromagnetic induction for surface/near-surface flaws)
- MT: Magnetic Particle Testing (surface and near-surface flaws in ferromagnetic materials)
- PT: Penetrant Testing / Dye Penetrant (surface-opening cracks and pores)
- VT: Visual Testing (direct or remote visual examination)

Respond ONLY with valid JSON in this exact format:
{
  "inspectionTypes": ["RT", "UT"],
  "confidence": "high|medium|low",
  "notes": "brief explanation of what clues led to this classification"
}`;

// ─── Email classify helpers ────────────────────────────────────

/** Extract sender domains: primary From field + embedded patterns in body (FWD, inline from, formal headers) */
function extractDomains(from: string, body: string): string[] {
  const domains = new Set<string>();

  // Pass 1: primary From field (highest priority)
  const primary = from.match(/@([\w.-]+\.\w{2,})/);
  if (primary) domains.add(primary[1].toLowerCase());

  // Pass 2: formal header — "From: Name <email@domain>" or "From: email@domain"
  for (const m of body.matchAll(/(?:From|De):\s*[^<\n]*<?[a-zA-Z0-9._%+\-]+@([\w.-]+\.\w{2,})>?/gi)) {
    domains.add(m[1].toLowerCase());
  }

  // Pass 3: "from email@domain" — word "from" directly before an email (colon may follow the email, not "from")
  for (const m of body.matchAll(/\bfrom\s+[a-zA-Z0-9._%+\-]+@([\w.-]+\.\w{2,})/gi)) {
    domains.add(m[1].toLowerCase());
  }

  // Pass 4: FWD/Forwarded lines — "FWD --- email@domain" or "Forwarded from email@domain"
  for (const m of body.matchAll(/(?:FWD|Forward(?:ed)?)[^@\n]{0,60}[a-zA-Z0-9._%+\-]+@([\w.-]+\.\w{2,})/gi)) {
    domains.add(m[1].toLowerCase());
  }

  // Pass 5: broad scan — every email address anywhere in body, regardless of surrounding format
  // This catches any format not handled above (HTML entities, odd whitespace, etc.)
  // lookupCustomer tries each domain in order; unknown domains (sender's own) simply fail to match and fall through
  for (const m of body.matchAll(/[a-zA-Z0-9._%+\-]+@([\w.-]+\.\w{2,})/g)) {
    domains.add(m[1].toLowerCase());
  }

  return [...domains];
}

/** From "flowserve.com" return "flowserve" — the longest non-TLD segment ≥ 4 chars */
function domainKeyword(domain: string): string {
  const parts = domain.split('.').slice(0, -1); // strip TLD
  return parts.sort((a, b) => b.length - a.length).find(p => p.length >= 4) ?? parts[0] ?? domain;
}

interface CustomerResult { found: boolean; name?: string; matchMethod?: 'email' | 'domain' }
interface PartResult {
  found: boolean;
  partNumber?: string | null;
  lastQuote?: { quoteNumber: string; date: string; grandTotal: number; accountName: string };
}

async function lookupCustomer(domains: string[], pool: import('pg').Pool): Promise<CustomerResult> {
  for (const domain of domains) {
    // Step 1: exact email domain match in contacts
    const contactRes = await pool.query<{ sf_id: string; name: string }>(
      `SELECT DISTINCT a.sf_id, a.name
       FROM sf.contacts c
       JOIN sf.accounts a ON a.sf_id = c.account_sf_id
       WHERE c.email ILIKE '%@' || $1
       ORDER BY a.name LIMIT 1`,
      [domain],
    );
    if (contactRes.rows.length > 0) {
      return { found: true, name: contactRes.rows[0].name, matchMethod: 'email' };
    }

    // Step 2: domain keyword match on account name
    const kw = domainKeyword(domain);
    const acctRes = await pool.query<{ sf_id: string; name: string }>(
      `SELECT sf_id, name
       FROM sf.accounts
       WHERE name ILIKE '%' || $1 || '%'
       ORDER BY ytd_total DESC NULLS LAST LIMIT 1`,
      [kw],
    );
    if (acctRes.rows.length > 0) {
      return { found: true, name: acctRes.rows[0].name, matchMethod: 'domain' };
    }
  }
  return { found: false };
}

const PART_REGEX = /\b([A-Z0-9]{2,}[-\/][A-Z0-9]{1,}(?:[-\/][A-Z0-9]+)*|[A-Z]{1,3}\d{5,})\b/g;
const PART_STOPWORDS = new Set(['RT','UT','MT','PT','VT','ET','NDT','FAA','PO','REV','NO','ID','AM','PM','OK']);

async function lookupPart(text: string, pool: import('pg').Pool): Promise<PartResult> {
  const candidates = [...new Set([...text.matchAll(PART_REGEX)].map(m => m[1]))].filter(p => !PART_STOPWORDS.has(p));
  for (const partNumber of candidates) {
    const qRes = await pool.query<{ quote_number: string; date: string; grand_total: string; account_name: string }>(
      `SELECT q.quote_number, (q.created_date::date)::text AS date, q.grand_total::text, a.name AS account_name
       FROM sf.quotes q
       JOIN sf.accounts a ON a.sf_id = q.account_sf_id
       WHERE q.part_numbers ILIKE '%' || $1 || '%'
         AND q.quote_number IS NOT NULL
       UNION ALL
       SELECT q.quote_number, (q.created_date::date)::text, q.grand_total::text, a.name
       FROM sf.quotes q
       JOIN sf.accounts a ON a.sf_id = q.account_sf_id
       JOIN sf.jobs j ON j.sf_id = q.job_sf_id
       WHERE j.part_number ILIKE '%' || $1 || '%'
         AND q.quote_number IS NOT NULL
       ORDER BY date DESC NULLS LAST
       LIMIT 1`,
      [partNumber],
    );
    if (qRes.rows.length > 0) {
      const r = qRes.rows[0];
      return {
        found: true,
        partNumber,
        lastQuote: {
          quoteNumber: r.quote_number,
          date: r.date,
          grandTotal: parseFloat(r.grand_total),
          accountName: r.account_name,
        },
      };
    }
    // Part was detected but no quote found — still report it
    return { found: false, partNumber };
  }
  return { found: false, partNumber: null };
}

router.post('/email/classify', async (req: Request, res: Response) => {
  const { subject, from, body, snippet } = req.body ?? {};

  if (!body && !snippet && !subject) {
    return res.status(400).json({ error: 'Must provide at least one of: body, snippet, subject' });
  }

  const emailText = [
    subject ? `Subject: ${subject}` : '',
    from ? `From: ${from}` : '',
    body || snippet || '',
  ].filter(Boolean).join('\n\n');

  const fullText = `${subject ?? ''} ${body ?? snippet ?? ''}`;

  // ─── DB enrichment (parallel, non-fatal) ──────────────────────
  const { Pool } = await import('pg');
  const pool = new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  const domains = extractDomains(from ?? '', body ?? snippet ?? '');

  const [customerSettled, partSettled] = await Promise.allSettled([
    lookupCustomer(domains, pool),
    lookupPart(fullText, pool),
  ]);
  await pool.end();

  const customer: CustomerResult = customerSettled.status === 'fulfilled'
    ? customerSettled.value
    : { found: false };
  const partDetection: PartResult = partSettled.status === 'fulfilled'
    ? partSettled.value
    : { found: false, partNumber: null };

  // ─── Try gateway LLM first, fall back to keyword matching ─────
  try {
    const gwResponse = await fetch(`${GATEWAY_URL}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        messages: [
          { role: 'user', content: emailText }
        ],
        system: classifySystemPrompt,
        max_tokens: 256,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (gwResponse.ok) {
      const gwData = await gwResponse.json() as { content?: Array<{ text?: string }> };
      const text = gwData?.content?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { inspectionTypes?: string[]; confidence?: string; notes?: string };
        const valid = (parsed.inspectionTypes ?? []).filter(t => INSPECTION_TYPES.includes(t as typeof INSPECTION_TYPES[number]));
        return res.json({
          inspectionTypes: valid,
          confidence: parsed.confidence ?? 'medium',
          notes: parsed.notes ?? '',
          source: 'llm',
          customer,
          partDetection,
        });
      }
    }
  } catch (err) {
    console.warn('[email/classify] gateway unavailable, falling back to keyword match:', (err as Error).message);
  }

  // Keyword fallback
  const lower = emailText.toLowerCase();
  const detected: string[] = [];
  if (/\brt\b|radiograph|radiography|x.?ray|gamma.?ray|\bfilm\b|rad\s*test/.test(lower)) detected.push('RT');
  if (/\but\b|ultrasonic|ultrasound|phased.?array|\btofd\b|shear.?wave|immersion\s*(test|scan)|c.?scan|\bcscan\b|thickness\s*(test|measur|check)/.test(lower)) detected.push('UT');
  if (/\bet\b|eddy.?current|\bect\b/.test(lower)) detected.push('ET');
  if (/\bmt\b|magnetic.?particle|mag.?particle|\bmpi\b|mag\s*test/.test(lower)) detected.push('MT');
  if (/\bpt\b|penetrant|dye.?pen|\blpi\b|\bfpi\b|liquid\s*penetrant|fluorescent\s*penetrant/.test(lower)) detected.push('PT');
  if (/\bvt\b|visual\s*(test|inspect|examin)/.test(lower)) detected.push('VT');

  return res.json({
    inspectionTypes: detected.length > 0 ? detected : [],
    confidence: detected.length > 0 ? 'medium' : 'low',
    notes: detected.length === 0
      ? 'No specific NDT method keywords found in email'
      : `Keyword match found: ${detected.join(', ')}`,
    source: 'keyword',
    customer,
    partDetection,
  });
});

export default router;
