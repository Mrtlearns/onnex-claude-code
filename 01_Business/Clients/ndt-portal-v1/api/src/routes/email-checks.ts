/**
 * Email Checks settings routes — CRUD for app.email_checks
 * Mounted at /email-checks
 *
 * GET    /email-checks        — list all checks (ordered by sort_order)
 * PATCH  /email-checks/:id    — update a check (enabled, response_message, sort_order)
 * PATCH  /email-checks/reorder — reorder checks [{id, sort_order}]
 *
 * Note: checks are seeded by migration 041 and are not created/deleted via UI.
 * Admins can enable/disable and edit response messages only.
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { requirePermission } from '../middleware/requirePermission'

const router = Router()

// ── Zod schemas ──────────────────────────────────────────────────────────────

const PatchBody = z.object({
  enabled:          z.boolean().optional(),
  response_message: z.string().optional(),
  name:             z.string().min(1).max(200).optional(),
  description:      z.string().optional(),
  sort_order:       z.number().int().optional(),
})

const ReorderBody = z.array(z.object({
  id:         z.string().uuid(),
  sort_order: z.number().int(),
}))

// ── GET /email-checks ────────────────────────────────────────────────────────

router.get('/', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT id, code, name, description, enabled, sort_order, response_message, created_at, updated_at
       FROM app.email_checks
       ORDER BY sort_order, code`
    )
    return res.json(rows)
  } catch (err) {
    console.error('[email-checks] list error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PATCH /email-checks/:id ──────────────────────────────────────────────────

router.patch('/:id', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req: Request, res: Response) => {
  const parsed = PatchBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }

  const body = parsed.data
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1

  if (body.enabled          !== undefined) { sets.push(`enabled=$${i++}`);           vals.push(body.enabled) }
  if (body.response_message !== undefined) { sets.push(`response_message=$${i++}`);  vals.push(body.response_message) }
  if (body.name             !== undefined) { sets.push(`name=$${i++}`);              vals.push(body.name) }
  if (body.description      !== undefined) { sets.push(`description=$${i++}`);       vals.push(body.description) }
  if (body.sort_order       !== undefined) { sets.push(`sort_order=$${i++}`);        vals.push(body.sort_order) }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'Nothing to update' })
  }

  sets.push(`updated_at=now()`)
  vals.push(req.params.id)

  try {
    const row = await queryOne(
      `UPDATE app.email_checks SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`,
      vals
    )
    if (!row) return res.status(404).json({ error: 'Not found' })
    return res.json(row)
  } catch (err) {
    console.error('[email-checks] patch error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PATCH /email-checks/reorder ──────────────────────────────────────────────

router.patch('/reorder', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req: Request, res: Response) => {
  const parsed = ReorderBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }

  try {
    await Promise.all(
      parsed.data.map(({ id, sort_order }) =>
        query('UPDATE app.email_checks SET sort_order=$1, updated_at=now() WHERE id=$2', [sort_order, id])
      )
    )
    return res.status(204).end()
  } catch (err) {
    console.error('[email-checks] reorder error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
