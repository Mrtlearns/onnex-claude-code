import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// ── GET /quotes — combined UT + RT + Email quote history ──────
router.get('/', requirePermission('QUOTE_VIEW'), async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT id, quote_number, customer_name, source, grand_total::float AS grand_total, status, created_at,
             'ut' AS quote_type, intake_id::text AS intake_id, NULL AS part_number,
             ARRAY[]::text[] AS inspection_types, false AS is_new_prospect
      FROM ut.incoming_quotes
      UNION ALL
      SELECT id, quote_number, customer_name, source, grand_total::float AS grand_total, status, created_at,
             'rt' AS quote_type, NULL AS intake_id, part_number,
             ARRAY[]::text[] AS inspection_types, false AS is_new_prospect
      FROM rt.incoming_quotes
      UNION ALL
      SELECT id, quote_number, customer_name, 'email' AS source,
             0.0 AS grand_total, status, created_at,
             'email' AS quote_type, NULL AS intake_id, NULL AS part_number,
             inspection_types, (customer_id IS NULL) AS is_new_prospect
      FROM app.email_quotes
      ORDER BY created_at DESC
      LIMIT 200
    `);
    return res.json(rows);
  } catch (e) {
    console.error('GET /quotes error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
