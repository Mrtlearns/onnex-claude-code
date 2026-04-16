/**
 * Inbox routes — email-sourced quote requests
 *
 * Mounted at /inbox
 *
 * POST /inbox/process           — called by n8n WF-6 when a new email arrives
 * GET  /inbox/quotes            — list email quotes (Kanban + Inbox page)
 * GET  /inbox/quotes/:id        — single email quote with checks result
 * GET  /inbox/quotes/:id/thread — conversation thread messages
 * PATCH /inbox/quotes/:id/status — manual status update
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { requirePermission } from '../middleware/requirePermission'

const router = Router()

// ── Internal secret for n8n → API calls (no user JWT) ──────────────────────
function verifyN8nSecret(req: Request, res: Response): boolean {
  const secret = process.env.N8N_INTERNAL_SECRET
  if (!secret) return true  // dev: allow if not configured
  const provided = req.headers['x-n8n-secret']
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized', code: 'N8N_SECRET_MISMATCH' })
    return false
  }
  return true
}

// ── Internal sender detection ────────────────────────────────────────────────
// Emails from these addresses/domain are forwarded RFQs from the testing team.
// They are NOT treated as customer contacts.

const INTERNAL_SENDER_EMAILS = new Set([
  'mrt@on-nex.com',
  'mrtmaharaj@gmail.com',
])
const INTERNAL_SENDER_DOMAIN = 'ndtesting.com'

function isInternalSender(email: string): boolean {
  const lower = email.toLowerCase()
  if (INTERNAL_SENDER_EMAILS.has(lower)) return true
  const domain = lower.split('@')[1] ?? ''
  return domain === INTERNAL_SENDER_DOMAIN
}

// ── MSG attachment parser ────────────────────────────────────────────────────

interface MsgContent {
  subject:     string | null
  fromEmail:   string | null
  fromName:    string | null
  body:        string | null
}

function parseMsgAttachment(base64urlData: string): MsgContent | null {
  try {
    // Gmail API returns base64url — convert to standard base64 before decoding
    const base64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/')
    const buffer = Buffer.from(base64, 'base64')

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: MsgReader } = require('@kenjiuno/msgreader')
    const reader = new MsgReader(buffer)
    const info = reader.getFileData() as {
      subject?:     string
      senderEmail?: string
      senderName?:  string
      body?:        string
      bodyHtml?:    string
    }

    return {
      subject:   info.subject   ?? null,
      fromEmail: info.senderEmail ?? null,
      fromName:  info.senderName  ?? null,
      body:      info.body ?? info.bodyHtml ?? null,
    }
  } catch (err) {
    console.error('[inbox/parseMsgAttachment] parse error:', err)
    return null
  }
}

// ── Zod schemas ─────────────────────────────────────────────────────────────

const ProcessEmailBody = z.object({
  gmailMessageId:      z.string().min(1),
  gmailThreadId:       z.string().min(1),
  labelIds:            z.array(z.string()).default([]),
  subject:             z.string().default(''),
  from:                z.string().min(1),
  to:                  z.string().default(''),
  date:                z.string().default(''),
  snippet:             z.string().default(''),
  body:                z.string().default(''),
  hasAttachments:      z.boolean().default(false),
  attachmentFilenames: z.array(z.string()).default([]),
  // base64url-encoded .msg file bytes (first .msg attachment, if present)
  msgAttachmentData:   z.string().nullable().optional(),
})

const StatusPatchBody = z.object({
  status: z.enum(['received', 'checking', 'needs_info', 'processing', 'quoted', 'failed']),
})

// ── Helper: parse sender email from "Name <email>" or plain email ───────────

function parseSenderEmail(from: string): { name: string | null; email: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim() || null, email: match[2].trim().toLowerCase() }
  }
  return { name: null, email: from.trim().toLowerCase() }
}

// ── POST /inbox/process — n8n calls this per email ─────────────────────────

router.post('/process', async (req: Request, res: Response) => {
  if (!verifyN8nSecret(req, res)) return

  const parsed = ProcessEmailBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }
  const data = parsed.data

  try {
    const { email: senderEmail, name: senderName } = parseSenderEmail(data.from)

    // ── Reject bounce / NDR / auto-generated emails ───────────────────────
    const isBounce =
      /^(postmaster|mailer-daemon|no-?reply)@/i.test(senderEmail) ||
      /^(undeliverable|delivery.*failed|returned mail|mail delivery)/i.test(data.subject)
    if (isBounce) {
      console.log(`[inbox/process] Ignoring bounce/NDR from ${senderEmail}: ${data.subject}`)
      return res.json({ ignored: true, reason: 'bounce/NDR', senderEmail })
    }

    const hasRePrefix = /^re:/i.test(data.subject.trim())

    // ── Determine if this is an internal/forwarded email ─────────────────────
    const internal = isInternalSender(senderEmail)

    // ── Extract .msg content if present ──────────────────────────────────────
    let msgContent: MsgContent | null = null
    if (data.msgAttachmentData) {
      msgContent = parseMsgAttachment(data.msgAttachmentData)
      if (msgContent) {
        console.log(`[inbox/process] Parsed .msg from ${senderEmail}: subject="${msgContent.subject}"`)
      }
    }

    // Effective subject/body for checks — prefer .msg content for internal senders
    // Fall back to Gmail snippet when body is empty (common with forwarded or HTML-only emails)
    const effectiveSubject = (internal && msgContent?.subject) ? msgContent.subject : data.subject
    const rawBody          = (internal && msgContent?.body)    ? msgContent.body    : data.body
    const effectiveBody    = rawBody.trim() || data.snippet.trim()

    // ── Reply path: check if this belongs to an existing thread ──────────────
    const existingQuote = await queryOne<{ id: string; quote_number: string; subject: string }>(
      `SELECT id, quote_number, subject FROM app.email_quotes
       WHERE gmail_thread_id = $1
       ORDER BY received_at ASC LIMIT 1`,
      [data.gmailThreadId]
    )

    if (existingQuote || hasRePrefix) {
      const targetId = existingQuote?.id

      if (targetId) {
        await query(
          `INSERT INTO app.email_threads
             (email_quote_id, direction, gmail_message_id, subject, body_text,
              sender_email, recipient_email, sent_at)
           VALUES ($1, 'inbound', $2, $3, $4, $5, $6, now())`,
          [targetId, data.gmailMessageId, data.subject, data.body,
           senderEmail, data.to.trim().toLowerCase()]
        )

        await query(
          `UPDATE app.email_quotes
           SET status = 'checking', updated_at = now()
           WHERE id = $1 AND status = 'needs_info'`,
          [targetId]
        )

        return res.json({ emailQuoteId: targetId, isReply: true, quoteNumber: existingQuote?.quote_number })
      }
    }

    // ── New quote path ────────────────────────────────────────────────────────

    // Customer lookup — two-tier: sf.contacts (email) → ut.customers (domain)
    // Skipped for internal senders (they are testers, not customers)
    let customer: { id: string; name: string } | null = null
    if (!internal) {
      const domain = senderEmail.split('@')[1] ?? ''

      // Tier 1: exact email match via SF contacts → ut.customers
      customer = await queryOne<{ id: string; name: string }>(
        `SELECT u.id, u.name FROM sf.contacts c
         JOIN sf.accounts a ON a.sf_id = c.account_sf_id
         JOIN ut.customers u ON u.sf_account_id = a.sf_id
         WHERE LOWER(c.email) = $1
         LIMIT 1`,
        [senderEmail]
      )

      // Tier 2: domain match on ut.customers
      if (!customer) {
        customer = await queryOne<{ id: string; name: string }>(
          `SELECT id, name FROM ut.customers
           WHERE LOWER(domain) = $1
           LIMIT 1`,
          [domain]
        )
      }
    }

    // customer_name: for internal senders show "Internal — <sender>" instead
    const customerName = internal
      ? `Internal tester — ${senderName ?? senderEmail}`
      : (customer?.name ?? senderEmail)

    // ── Part number extraction + BOM lookup ─────────────────────────────────
    const fullText = `${effectiveSubject} ${effectiveBody}`
    const partPatterns = [
      /p[\/#]?n[\s:.]+(\S+)/gi,
      /part\s*(?:no|number|#)[\s:.]+(\S+)/gi,
      /\bpn[\s:.]+(\S+)/gi,
      /\b([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/g,  // hyphenated codes like L107331-001
    ]
    const candidateParts = new Set<string>()
    for (const pat of partPatterns) {
      let m: RegExpExecArray | null
      while ((m = pat.exec(fullText)) !== null) {
        const val = (m[1] ?? m[0]).replace(/[.,;:)]+$/, '').trim()
        if (val.length >= 3 && val.length <= 50 && !/^(RT|UT|ET|MT|PT|VT|PSI|FAX|USA|LLC|INC|LTD|N\/A)$/i.test(val)) {
          candidateParts.add(val.toUpperCase())
        }
      }
    }
    const detectedParts = [...candidateParts]

    // Look up detected parts in SF BOM
    let matchedPart: { part_number: string; account_name: string; services: string[] } | null = null
    if (detectedParts.length > 0) {
      matchedPart = await queryOne<{ part_number: string; account_name: string; services: string[] }>(
        `SELECT part_number, account_name, services
         FROM sf.bom_parts
         WHERE UPPER(part_number) = ANY($1)
         ORDER BY job_count DESC
         LIMIT 1`,
        [detectedParts]
      )
    }

    // Create email quote
    const newQuote = await queryOne<{ id: string; quote_number: string }>(
      `INSERT INTO app.email_quotes
         (gmail_message_id, gmail_thread_id, gmail_label_ids,
          sender_email, sender_name,
          customer_id, customer_name,
          subject, body_text,
          is_internal_sender,
          msg_original_subject, msg_original_from,
          detected_part_numbers, matched_part_number, matched_part_account, matched_part_services,
          status, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'received', now())
       RETURNING id, quote_number`,
      [
        data.gmailMessageId,
        data.gmailThreadId,
        data.labelIds,
        senderEmail,
        senderName,
        customer?.id ?? null,
        customerName,
        effectiveSubject,
        effectiveBody,
        internal,
        msgContent?.subject ?? null,
        msgContent?.fromEmail ?? null,
        detectedParts,
        matchedPart?.part_number ?? null,
        matchedPart?.account_name ?? null,
        matchedPart?.services ?? [],
      ]
    )

    if (!newQuote) {
      return res.status(500).json({ error: 'Failed to create email quote' })
    }

    // Store inbound thread message — always use the original email body for thread history
    await query(
      `INSERT INTO app.email_threads
         (email_quote_id, direction, gmail_message_id, subject, body_text,
          sender_email, recipient_email, sent_at)
       VALUES ($1, 'inbound', $2, $3, $4, $5, $6, now())`,
      [newQuote.id, data.gmailMessageId, data.subject, data.body,
       senderEmail, data.to.trim().toLowerCase()]
    )

    // Run email checks asynchronously — reply target is always sender_email,
    // which for internal senders IS the tester (correct behaviour).
    setImmediate(async () => {
      try {
        const { runEmailChecks } = await import('../lib/emailChecks')
        await runEmailChecks(newQuote.id, {
          subject:             effectiveSubject,
          body:                effectiveBody,
          from:                data.from,
          hasAttachments:      data.hasAttachments,
          attachmentFilenames: data.attachmentFilenames,
          isInternalSender:    internal,
        })
      } catch (err) {
        console.error('[inbox/process] email checks error:', err)
        await query(
          `UPDATE app.email_quotes SET status='failed', updated_at=now() WHERE id=$1`,
          [newQuote.id]
        )
      }
    })

    return res.status(201).json({
      emailQuoteId:       newQuote.id,
      quoteNumber:        newQuote.quote_number,
      isReply:            false,
      isNewProspect:      !internal && !customer,
      isInternalSender:   internal,
      msgContentExtracted: !!msgContent,
    })

  } catch (err) {
    console.error('[inbox/process] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /inbox/quotes — list all email quotes ──────────────────────────────

router.get('/quotes', requirePermission('INBOX_VIEW'), async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT
        id, quote_number, sender_email, sender_name,
        customer_id, customer_name,
        inspection_types, classification_confidence, classification_source,
        subject, status, llm_routing,
        nextcloud_paths,
        is_internal_sender,
        msg_original_subject, msg_original_from,
        received_at, created_at, updated_at
      FROM app.email_quotes
      ORDER BY received_at DESC
      LIMIT 200
    `)
    return res.json(rows)
  } catch (err) {
    console.error('[inbox/quotes] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /inbox/quotes/:id — single quote with latest check results ─────────

router.get('/quotes/:id', requirePermission('INBOX_VIEW'), async (req: Request, res: Response) => {
  try {
    const quote = await queryOne(
      `SELECT * FROM app.email_quotes WHERE id = $1`,
      [req.params.id]
    )
    if (!quote) return res.status(404).json({ error: 'Not found' })
    return res.json(quote)
  } catch (err) {
    console.error('[inbox/quotes/:id] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /inbox/quotes/:id/thread — conversation messages ──────────────────

router.get('/quotes/:id/thread', requirePermission('INBOX_VIEW'), async (req: Request, res: Response) => {
  try {
    const messages = await query(
      `SELECT id, direction, gmail_message_id, subject, body_text,
              sender_email, recipient_email, triggered_by_check_code,
              nextcloud_paths, sent_at, created_at
       FROM app.email_threads
       WHERE email_quote_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    )
    return res.json(messages)
  } catch (err) {
    console.error('[inbox/quotes/:id/thread] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PATCH /inbox/quotes/:id/status — manual status transition ─────────────

router.patch('/quotes/:id/status', requirePermission('INBOX_VIEW'), async (req: Request, res: Response) => {
  const parsed = StatusPatchBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status', details: parsed.error.flatten() })
  }

  try {
    const updated = await queryOne(
      `UPDATE app.email_quotes
       SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, quote_number, status`,
      [parsed.data.status, req.params.id]
    )
    if (!updated) return res.status(404).json({ error: 'Not found' })
    return res.json(updated)
  } catch (err) {
    console.error('[inbox/quotes/:id/status] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
