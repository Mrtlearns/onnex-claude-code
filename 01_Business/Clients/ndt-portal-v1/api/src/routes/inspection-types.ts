import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// ── Zod schemas ──────────────────────────────────────────────────────────────
const TypeBody = z.object({
  code:        z.string().min(1).max(20).toUpperCase(),
  label:       z.string().min(1).max(100),
  description: z.string().default(''),
  is_active:   z.boolean().default(true),
  sort_order:  z.number().int().default(0),
});

const StepBody = z.object({
  name:         z.string().min(1).max(200),
  action_type:  z.enum(['llm', 'python', 'n8n', 'webhook', 'system']),
  instruction:  z.string().nullable().default(null),
  python_code:  z.string().nullable().default(null),
  n8n_workflow: z.string().nullable().default(null),
  webhook_url:  z.string().nullable().default(null),
  sort_order:   z.number().int().default(0),
  is_active:    z.boolean().default(true),
  provider:     z.string().nullable().default(null),
  model:        z.string().nullable().default(null),
  config:       z.record(z.unknown()).nullable().default(null),
});

const ReorderBody = z.array(z.object({
  id:         z.string().uuid(),
  sort_order: z.number().int(),
}));

// ── Inspection Types CRUD ────────────────────────────────────────────────────

// GET /inspection-types
router.get('/', requirePermission('SETTINGS_VIEW'), async (_req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM app.inspection_types ORDER BY sort_order, code',
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /inspection-types
router.post('/', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req, res, next) => {
  try {
    const body = TypeBody.parse(req.body);
    const row = await queryOne(
      `INSERT INTO app.inspection_types (code, label, description, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [body.code, body.label, body.description, body.is_active, body.sort_order],
    );
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// PATCH /inspection-types/:id
router.patch('/:id', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req, res, next) => {
  try {
    const body = TypeBody.partial().parse(req.body);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (body.code        !== undefined) { sets.push(`code=$${i++}`);        vals.push(body.code.toUpperCase()); }
    if (body.label       !== undefined) { sets.push(`label=$${i++}`);       vals.push(body.label); }
    if (body.description !== undefined) { sets.push(`description=$${i++}`); vals.push(body.description); }
    if (body.is_active   !== undefined) { sets.push(`is_active=$${i++}`);   vals.push(body.is_active); }
    if (body.sort_order  !== undefined) { sets.push(`sort_order=$${i++}`);  vals.push(body.sort_order); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at=now()`);
    vals.push(req.params.id);
    const row = await queryOne(
      `UPDATE app.inspection_types SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`,
      vals,
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { next(e); }
});

// DELETE /inspection-types/:id
router.delete('/:id', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req, res, next) => {
  try {
    await query('DELETE FROM app.inspection_types WHERE id=$1', [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Steps CRUD ───────────────────────────────────────────────────────────────

// GET /inspection-types/:id/steps
router.get('/:id/steps', requirePermission('SETTINGS_VIEW'), async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM app.inspection_steps WHERE inspection_type_id=$1 ORDER BY sort_order, created_at',
      [req.params.id],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /inspection-types/:id/steps
router.post('/:id/steps', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req, res, next) => {
  try {
    const body = StepBody.parse(req.body);
    const row = await queryOne(
      `INSERT INTO app.inspection_steps
         (inspection_type_id, name, action_type, instruction, python_code, n8n_workflow, webhook_url, sort_order, is_active, provider, model, config)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.params.id, body.name, body.action_type, body.instruction, body.python_code,
       body.n8n_workflow, body.webhook_url, body.sort_order, body.is_active, body.provider, body.model,
       body.config ? JSON.stringify(body.config) : null],
    );
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// PATCH /inspection-types/:id/steps/:stepId
router.patch('/:id/steps/:stepId', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req, res, next) => {
  try {
    const body = StepBody.partial().parse(req.body);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const fields: Array<[string, unknown]> = [
      ['name',         body.name],
      ['action_type',  body.action_type],
      ['instruction',  body.instruction],
      ['python_code',  body.python_code],
      ['n8n_workflow', body.n8n_workflow],
      ['webhook_url',  body.webhook_url],
      ['sort_order',   body.sort_order],
      ['is_active',    body.is_active],
      ['provider',     body.provider],
      ['model',        body.model],
      ['config',       body.config !== undefined ? (body.config === null ? null : JSON.stringify(body.config)) : undefined],
    ];
    for (const [col, val] of fields) {
      if (val !== undefined) { sets.push(`${col}=$${i++}`); vals.push(val); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at=now()`);
    vals.push(req.params.stepId);
    const row = await queryOne(
      `UPDATE app.inspection_steps SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`,
      vals,
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { next(e); }
});

// DELETE /inspection-types/:id/steps/:stepId
router.delete('/:id/steps/:stepId', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req, res, next) => {
  try {
    await query('DELETE FROM app.inspection_steps WHERE id=$1', [req.params.stepId]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// PATCH /inspection-types/:id/steps/reorder  — body: [{id, sort_order}, ...]
router.patch('/:id/steps/reorder', requirePermission('SETTINGS_INSPECTION_TYPES'), async (req, res, next) => {
  try {
    const items = ReorderBody.parse(req.body);
    await Promise.all(
      items.map(({ id, sort_order }) =>
        query('UPDATE app.inspection_steps SET sort_order=$1, updated_at=now() WHERE id=$2', [sort_order, id]),
      ),
    );
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
