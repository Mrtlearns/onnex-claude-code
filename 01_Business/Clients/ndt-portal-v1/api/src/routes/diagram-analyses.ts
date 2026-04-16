/**
 * Diagram Analyses routes — central LLM analysis store (all inspection types)
 *
 * Mounted at /diagram-analyses
 *
 * GET  /diagram-analyses          — list all analyses (filterable)
 * GET  /diagram-analyses/:id      — single analysis
 * POST /diagram-analyses          — create (called by pipeline steps)
 * GET  /diagram-analyses/quote/:quoteNumber — all analyses for a quote
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { requirePermission } from '../middleware/requirePermission'

const router = Router()

// ── Zod schemas ─────────────────────────────────────────────────────────────

const CreateAnalysisBody = z.object({
  // Source quote — at least one must be provided
  emailQuoteId: z.string().uuid().optional(),
  utQuoteId:    z.string().uuid().optional(),
  rtQuoteId:    z.string().optional(),

  quoteType:    z.enum(['email', 'ut', 'rt']),
  quoteNumber:  z.string().min(1),

  inspectionType: z.string().min(1).max(10).toUpperCase(),
  stepName:       z.string().min(1),
  rawResponse:    z.record(z.unknown()),

  modelUsed:   z.string().optional(),
  provider:    z.enum(['anthropic', 'ollama', 'other']).optional(),
  tokensUsed:  z.number().int().optional(),
  durationMs:  z.number().int().optional(),
})

const ListQuerySchema = z.object({
  inspectionType: z.string().optional(),
  quoteNumber:    z.string().optional(),
  quoteType:      z.enum(['email', 'ut', 'rt']).optional(),
  limit:          z.coerce.number().int().min(1).max(500).default(100),
})

// ── GET /diagram-analyses ─────────────────────────────────────────────────

router.get('/', requirePermission('QUOTE_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const parsed = ListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() })
  }
  const { inspectionType, quoteNumber, quoteType, limit } = parsed.data

  const conditions: string[] = []
  const vals: unknown[] = []
  let i = 1

  if (inspectionType) { conditions.push(`inspection_type = $${i++}`); vals.push(inspectionType.toUpperCase()) }
  if (quoteNumber)    { conditions.push(`quote_number ILIKE $${i++}`); vals.push(`%${quoteNumber}%`) }
  if (quoteType)      { conditions.push(`quote_type = $${i++}`); vals.push(quoteType) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  vals.push(limit)

  try {
    const rows = await query(
      `SELECT id, email_quote_id, ut_quote_id, rt_quote_id,
              quote_type, quote_number, inspection_type, step_name,
              raw_response, model_used, provider, tokens_used, duration_ms, created_at
       FROM app.diagram_analyses
       ${where}
       ORDER BY created_at DESC
       LIMIT $${i}`,
      vals
    )
    return res.json(rows)
  } catch (err) {
    console.error('[diagram-analyses] list error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /diagram-analyses/quote/:quoteNumber ──────────────────────────────

router.get('/quote/:quoteNumber', requirePermission('QUOTE_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT id, email_quote_id, ut_quote_id, rt_quote_id,
              quote_type, quote_number, inspection_type, step_name,
              raw_response, model_used, provider, tokens_used, duration_ms, created_at
       FROM app.diagram_analyses
       WHERE quote_number = $1
       ORDER BY inspection_type, created_at`,
      [req.params.quoteNumber]
    )
    return res.json(rows)
  } catch (err) {
    console.error('[diagram-analyses/quote] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /diagram-analyses/:id ─────────────────────────────────────────────

router.get('/:id', requirePermission('QUOTE_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  try {
    const row = await queryOne(
      `SELECT * FROM app.diagram_analyses WHERE id = $1`,
      [req.params.id]
    )
    if (!row) return res.status(404).json({ error: 'Not found' })
    return res.json(row)
  } catch (err) {
    console.error('[diagram-analyses/:id] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /diagram-analyses — pipeline steps store analysis results ─────────

router.post('/', requirePermission('QUOTE_ANALYSIS_VIEW'), async (req: Request, res: Response) => {
  const parsed = CreateAnalysisBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }
  const d = parsed.data

  if (!d.emailQuoteId && !d.utQuoteId && !d.rtQuoteId) {
    return res.status(400).json({ error: 'At least one of emailQuoteId, utQuoteId, rtQuoteId is required' })
  }

  try {
    const row = await queryOne(
      `INSERT INTO app.diagram_analyses
         (email_quote_id, ut_quote_id, rt_quote_id,
          quote_type, quote_number, inspection_type, step_name,
          raw_response, model_used, provider, tokens_used, duration_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, quote_number, inspection_type, created_at`,
      [
        d.emailQuoteId ?? null,
        d.utQuoteId    ?? null,
        d.rtQuoteId    ?? null,
        d.quoteType,
        d.quoteNumber,
        d.inspectionType,
        d.stepName,
        JSON.stringify(d.rawResponse),
        d.modelUsed   ?? null,
        d.provider    ?? null,
        d.tokensUsed  ?? null,
        d.durationMs  ?? null,
      ]
    )
    return res.status(201).json(row)
  } catch (err) {
    console.error('[diagram-analyses] create error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
