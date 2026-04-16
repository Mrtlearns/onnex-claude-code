/**
 * Email Checks Engine
 *
 * Runs configurable completeness / classification checks against a newly
 * received email quote. Called from inbox.ts immediately after the
 * email_quote row is created.
 *
 * Flow:
 *   1. Load enabled checks from app.email_checks (ordered by sort_order)
 *   2. Run each check against the email content
 *   3. On first non-CUSTOMER_IDENTIFIED failure:
 *        a. Update quote status → needs_info
 *        b. Add outbound thread message
 *        c. Trigger n8n WF-7 to send the auto-reply via Gmail
 *   4. CUSTOMER_IDENTIFIED is flag-only (never blocks — prospect is flagged)
 *   5. On all blocking checks passed:
 *        a. Update quote status → processing
 *        b. Trigger 00-PRE pipeline (inspection-types step runner)
 */

import { query, queryOne } from '../db'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailCheckInput {
  subject:             string
  body:                string
  from:                string
  hasAttachments:      boolean
  attachmentFilenames: string[]
  isInternalSender:    boolean
}

export interface CheckResult {
  code:    string
  passed:  boolean
  details: string
}

interface EmailCheckRow {
  id:               string
  code:             string
  name:             string
  enabled:          boolean
  sort_order:       number
  response_message: string
}

// ── NDT keyword detection ────────────────────────────────────────────────────

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://gateway:8012'

const INSPECTION_TYPES = ['RT', 'UT', 'ET', 'MT', 'PT', 'VT'] as const

function keywordDetectTypes(text: string): string[] {
  const lower = text.toLowerCase()
  const detected: string[] = []
  // RT: Radiographic Testing
  if (/\brt\b|radiograph|radiography|x.?ray|gamma.?ray|\bfilm\b|rad\s*test/.test(lower)) detected.push('RT')
  // UT: Ultrasonic Testing
  if (/\but\b|ultrasonic|ultrasound|phased.?array|\btofd\b|shear.?wave|immersion\s*(test|scan)|c.?scan|\bcscan\b|thickness\s*(test|measur|check)/.test(lower)) detected.push('UT')
  // ET: Eddy Current Testing
  if (/\bet\b|eddy.?current|\bect\b/.test(lower)) detected.push('ET')
  // MT: Magnetic Particle Testing
  if (/\bmt\b|magnetic.?particle|mag.?particle|\bmpi\b|mag\s*test/.test(lower)) detected.push('MT')
  // PT: Penetrant Testing (Liquid / Fluorescent / Dye)
  if (/\bpt\b|penetrant|dye.?pen|\blpi\b|\bfpi\b|liquid\s*penetrant|fluorescent\s*penetrant/.test(lower)) detected.push('PT')
  // VT: Visual Testing
  if (/\bvt\b|visual\s*(test|inspect|examin)/.test(lower)) detected.push('VT')
  return detected
}

function keywordDetectPartMaterial(text: string): boolean {
  const lower = text.toLowerCase()
  // Part number: alphanumeric codes like "P/N:", "PN:", "Part No", or bare codes
  const hasPartNumber = /p[\/#]?n[\s:.]+\S+|part\s*(no|number|#)[\s:.]+\S+|\bpn[\s:.]+\S+/i.test(text)
  // Material: common NDT materials
  const hasMaterial = /carbon\s*steel|stainless|alumin|inconel|titanium|duplex|copper|cast\s*iron/i.test(lower)
  return hasPartNumber || hasMaterial
}

// ── LLM classify via gateway (reuses integrations.ts pattern) ───────────────

async function llmClassifyTypes(emailText: string): Promise<{
  types: string[]
  confidence: 'high' | 'medium' | 'low'
  source: 'llm' | 'keyword'
}> {
  const systemPrompt = `You are an NDT inspection request classifier. Read the email and identify NDT methods requested.
NDT Methods: RT (Radiographic), UT (Ultrasonic), ET (Eddy Current), MT (Magnetic Particle), PT (Penetrant), VT (Visual).
Respond ONLY with valid JSON: {"inspectionTypes": ["RT"], "confidence": "high|medium|low"}`

  try {
    const gwResponse = await fetch(`${GATEWAY_URL}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: emailText }],
        system: systemPrompt,
        max_tokens: 128,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (gwResponse.ok) {
      const gwData = await gwResponse.json() as { content?: Array<{ text?: string }> }
      const text = gwData?.content?.[0]?.text ?? ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { inspectionTypes?: string[]; confidence?: string }
        const valid = (parsed.inspectionTypes ?? [])
          .filter(t => INSPECTION_TYPES.includes(t as typeof INSPECTION_TYPES[number]))
        if (valid.length > 0) {
          return {
            types: valid,
            confidence: (parsed.confidence ?? 'medium') as 'high' | 'medium' | 'low',
            source: 'llm',
          }
        }
      }
    }
  } catch {
    // fall through to keyword
  }

  const keyword = keywordDetectTypes(emailText)
  return {
    types: keyword,
    confidence: keyword.length > 0 ? 'medium' : 'low',
    source: 'keyword',
  }
}

// ── Individual check runners ─────────────────────────────────────────────────

async function runCheck(code: string, input: EmailCheckInput): Promise<{ passed: boolean; details: string }> {
  switch (code) {
    case 'DIAGRAM_ATTACHED': {
      // .msg attachments count as a document — the original customer email IS the attachment
      const hasMsgFile = input.attachmentFilenames.some(f => f.toLowerCase().endsWith('.msg'))
      const passed = input.hasAttachments || hasMsgFile
      return {
        passed,
        details: passed
          ? (hasMsgFile ? 'Forwarded .msg message is the RFQ document' : 'Attachment present')
          : 'No attachments found',
      }
    }

    case 'CUSTOMER_IDENTIFIED': {
      // Flag-only: always passes (prospect flagging happens in inbox.ts)
      return { passed: true, details: 'Customer identification is flag-only — never blocks processing' }
    }

    case 'INSPECTION_TYPE_CLASSIFIABLE': {
      const fullText = `Subject: ${input.subject}\n\n${input.body}`
      const result = await llmClassifyTypes(fullText)
      const confident = result.types.length > 0 && result.confidence !== 'low'
      return {
        passed:  confident,
        details: confident
          ? `Detected: ${result.types.join(', ')} (${result.confidence} confidence, ${result.source})`
          : `Could not classify inspection type (confidence: ${result.confidence})`,
      }
    }

    case 'PART_MATERIAL_PRESENT': {
      const fullText = `${input.subject} ${input.body}`
      const found = keywordDetectPartMaterial(fullText)
      return {
        passed:  found,
        details: found ? 'Part number or material detected' : 'No part number or material found in email',
      }
    }

    default:
      return { passed: true, details: `Unknown check code: ${code} — skipped` }
  }
}

// ── n8n WF-7 trigger ─────────────────────────────────────────────────────────

async function triggerAutoReply(params: {
  to:           string
  subject:      string
  body:         string
  emailQuoteId: string
  checkCode:    string
}): Promise<void> {
  const wf7Url = process.env.N8N_EMAIL_REPLY_URL ?? 'http://n8n:5678/webhook/ndt-email-reply'
  try {
    await fetch(wf7Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Secret': process.env.N8N_INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    console.error('[emailChecks] WF-7 trigger failed:', err)
  }
}

// ── Update classification on email_quotes ────────────────────────────────────

async function updateQuoteClassification(emailQuoteId: string, input: EmailCheckInput): Promise<void> {
  const fullText = `Subject: ${input.subject}\n\n${input.body}`
  const result = await llmClassifyTypes(fullText)
  if (result.types.length > 0) {
    await query(
      `UPDATE app.email_quotes
       SET inspection_types = $1,
           classification_confidence = $2,
           classification_source = $3,
           updated_at = now()
       WHERE id = $4`,
      [result.types, result.confidence, result.source, emailQuoteId]
    )
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runEmailChecks(
  emailQuoteId: string,
  input: EmailCheckInput
): Promise<CheckResult[]> {
  // 1. Load enabled checks
  const checks = await query<EmailCheckRow>(
    `SELECT id, code, name, enabled, sort_order, response_message
     FROM app.email_checks
     WHERE enabled = true
     ORDER BY sort_order`,
    []
  )

  if (!checks.length) {
    // No checks configured → go straight to processing
    await query(
      `UPDATE app.email_quotes SET status = 'processing', updated_at = now() WHERE id = $1`,
      [emailQuoteId]
    )
    return []
  }

  // 2. Mark as checking
  await query(
    `UPDATE app.email_quotes SET status = 'checking', updated_at = now() WHERE id = $1`,
    [emailQuoteId]
  )

  // 3. Run inspection type classification in parallel (updates quote regardless of check results)
  updateQuoteClassification(emailQuoteId, input).catch(err =>
    console.error('[emailChecks] classification update error:', err)
  )

  // 4. Get sender email for auto-reply
  const quote = await queryOne<{ sender_email: string; subject: string }>(
    `SELECT sender_email, subject FROM app.email_quotes WHERE id = $1`,
    [emailQuoteId]
  )

  const results: CheckResult[] = []
  let firstBlockingFailure: { checkCode: string; responseMessage: string } | null = null

  // 5. Run checks in order
  for (const check of checks) {
    const { passed, details } = await runCheck(check.code, input)
    results.push({ code: check.code, passed, details })

    // CUSTOMER_IDENTIFIED never blocks
    if (!passed && check.code !== 'CUSTOMER_IDENTIFIED' && !firstBlockingFailure) {
      firstBlockingFailure = {
        checkCode:       check.code,
        responseMessage: check.response_message,
      }
    }
  }

  // 6. Handle first blocking failure
  if (firstBlockingFailure && quote) {
    await query(
      `UPDATE app.email_quotes SET status = 'needs_info', updated_at = now() WHERE id = $1`,
      [emailQuoteId]
    )

    // Add outbound thread message
    await query(
      `INSERT INTO app.email_threads
         (email_quote_id, direction, subject, body_text,
          sender_email, recipient_email, triggered_by_check_code, sent_at)
       VALUES ($1, 'outbound', $2, $3, $4, $5, $6, now())`,
      [
        emailQuoteId,
        `Re: ${quote.subject}`,
        firstBlockingFailure.responseMessage,
        'ndtautoquotes@gmail.com',
        quote.sender_email,
        firstBlockingFailure.checkCode,
      ]
    )

    // Trigger WF-7
    await triggerAutoReply({
      to:           process.env.AUTO_REPLY_OVERRIDE ?? quote.sender_email,
      subject:      quote.subject,
      body:         firstBlockingFailure.responseMessage,
      emailQuoteId,
      checkCode:    firstBlockingFailure.checkCode,
    })

    return results
  }

  // 7. All blocking checks passed → move to processing
  await query(
    `UPDATE app.email_quotes SET status = 'processing', updated_at = now() WHERE id = $1`,
    [emailQuoteId]
  )

  // 8. Trigger 00-PRE pipeline (fire and forget — pipeline updates status itself)
  const gatewayUrl = process.env.GATEWAY_URL ?? 'http://ndtv1-gateway:8080'
  fetch(`${gatewayUrl}/v1/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailQuoteId, pipelineType: '00-PRE' }),
    signal: AbortSignal.timeout(5000),
  }).catch(err => console.error('[emailChecks] pipeline trigger error:', err))

  return results
}
