/**
 * UT Rule Set CRUD + Traces API
 * Manages versioned calculation rule sets for the UT calculator.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET /rule-sets — list all rule sets ──────────────────────────
router.get('/rule-sets', requirePermission('UT_RULES_VIEW'), async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT rs.id, rs.name, rs.description, rs.is_active, rs.created_at, rs.created_by,
              COALESCE(v.version, 0) AS latest_version
       FROM ut_rules.rule_sets rs
       LEFT JOIN ut_rules.rule_set_versions v
         ON v.rule_set_id = rs.id AND v.is_latest = true
       ORDER BY rs.name`,
    );
    return res.json(rows);
  } catch (e) {
    console.error('GET /rule-sets error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /rule-sets/:id — single rule set with version list ──────
router.get('/rule-sets/:id', requirePermission('UT_RULES_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format', code: 'VALIDATION_ERROR' });
  }
  try {
    const rs = await queryOne(
      'SELECT id, name, description, is_active, created_at, created_by FROM ut_rules.rule_sets WHERE id = $1',
      [req.params.id],
    );
    if (!rs) return res.status(404).json({ error: 'Rule set not found', code: 'NOT_FOUND' });

    const versions = await query(
      `SELECT id, version, is_latest, notes, created_at, created_by
       FROM ut_rules.rule_set_versions
       WHERE rule_set_id = $1
       ORDER BY version DESC`,
      [req.params.id],
    );

    return res.json({ ...rs, versions });
  } catch (e) {
    console.error('GET /rule-sets/:id error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── POST /rule-sets — create new rule set ────────────────────────
const CreateRuleSetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cloneFromVersionId: z.string().uuid().optional(),
});

router.post('/rule-sets', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  // RBAC stub: future role check — requires 'RULE_SET_MANAGE' permission
  // await requirePermission(req, 'RULE_SET_MANAGE');

  const parsed = CreateRuleSetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  }
  const { name, description, cloneFromVersionId } = parsed.data;

  try {
    // Check name uniqueness
    const existing = await queryOne('SELECT id FROM ut_rules.rule_sets WHERE name = $1', [name]);
    if (existing) {
      return res.status(409).json({ error: `Rule set '${name}' already exists`, code: 'DUPLICATE' });
    }

    // Create rule set
    const rs = await queryOne<{ id: string }>(
      `INSERT INTO ut_rules.rule_sets (name, description, created_by)
       VALUES ($1, $2, $3) RETURNING id`,
      [name, description ?? null, 'system'],
    );

    // If cloning, create version 1 with copied rules
    if (cloneFromVersionId) {
      const version = await queryOne<{ id: string }>(
        `INSERT INTO ut_rules.rule_set_versions (rule_set_id, version, is_latest, notes, created_by)
         VALUES ($1, 1, true, $2, 'system') RETURNING id`,
        [rs!.id, `Cloned from version ${cloneFromVersionId}`],
      );

      await query(
        `INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
         SELECT $1, category, geometry_type, sort_order, label, description, definition
         FROM ut_rules.rules WHERE version_id = $2`,
        [version!.id, cloneFromVersionId],
      );

      await queryOne(
        `INSERT INTO ut_rules.change_log (rule_set_id, version_to, change_type, diff, changed_by)
         VALUES ($1, 1, 'clone', $2, 'system')`,
        [rs!.id, JSON.stringify({ clonedFrom: cloneFromVersionId })],
      );
    }

    return res.status(201).json({ id: rs!.id, name });
  } catch (e) {
    console.error('POST /rule-sets error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── POST /rule-sets/create-for-customer — auto-create + assign ──
const CreateForCustomerSchema = z.object({
  customerId: z.string().uuid(),
});

router.post('/rule-sets/create-for-customer', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  const parsed = CreateForCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  }
  const { customerId } = parsed.data;

  try {
    // Get customer name
    const customer = await queryOne<{ id: string; name: string; rule_set_id: string | null }>(
      'SELECT id, name, rule_set_id FROM ut.customers WHERE id = $1',
      [customerId],
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
    if (customer.rule_set_id) {
      // Already has a custom rule set — return it
      const existing = await queryOne<{ id: string; name: string }>(
        'SELECT id, name FROM ut_rules.rule_sets WHERE id = $1',
        [customer.rule_set_id],
      );
      return res.json({ id: existing!.id, name: existing!.name, alreadyExisted: true });
    }

    // Find default rule set's latest version to clone from
    const defaultLatest = await queryOne<{ id: string; version: number; rule_set_id: string }>(
      `SELECT v.id, v.version, v.rule_set_id
       FROM ut_rules.rule_set_versions v
       JOIN ut_rules.rule_sets rs ON rs.id = v.rule_set_id
       WHERE rs.name = 'default' AND v.is_latest = true`,
    );
    if (!defaultLatest) return res.status(500).json({ error: 'Default rule set not found', code: 'INTERNAL_ERROR' });

    // Create rule set named after customer
    const rsName = customer.name;
    const rs = await queryOne<{ id: string }>(
      `INSERT INTO ut_rules.rule_sets (name, description, created_by)
       VALUES ($1, $2, 'system') RETURNING id`,
      [rsName, `Custom rules for ${customer.name}, cloned from default v${defaultLatest.version}`],
    );

    // Create v1 with cloned rules
    const version = await queryOne<{ id: string }>(
      `INSERT INTO ut_rules.rule_set_versions (rule_set_id, version, is_latest, notes, created_by)
       VALUES ($1, 1, true, $2, 'system') RETURNING id`,
      [rs!.id, `Cloned from default v${defaultLatest.version}`],
    );

    await query(
      `INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
       SELECT $1, category, geometry_type, sort_order, label, description, definition
       FROM ut_rules.rules WHERE version_id = $2`,
      [version!.id, defaultLatest.id],
    );

    // Assign to customer
    await queryOne(
      'UPDATE ut.customers SET rule_set_id = $1 WHERE id = $2',
      [rs!.id, customerId],
    );

    // Log
    await queryOne(
      `INSERT INTO ut_rules.change_log (rule_set_id, version_to, change_type, diff, changed_by)
       VALUES ($1, 1, 'clone', $2, 'system')`,
      [rs!.id, JSON.stringify({ clonedFrom: defaultLatest.id, customer: customer.name })],
    );

    return res.status(201).json({ id: rs!.id, name: rsName, versionId: version!.id, alreadyExisted: false });
  } catch (e) {
    console.error('POST /rule-sets/create-for-customer error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── POST /rule-sets/assign — assign/unassign rule set to customer ─
const AssignSchema = z.object({
  customerId: z.string().uuid(),
  ruleSetId: z.string().uuid().nullable(),
  versionPin: z.number().int().positive().nullable().optional(),
});

router.post('/rule-sets/assign', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  const parsed = AssignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  }
  const { customerId, ruleSetId, versionPin } = parsed.data;

  try {
    const result = await queryOne<{ id: string }>(
      `UPDATE ut.customers SET rule_set_id = $1, rule_version_pin = $2 WHERE id = $3 RETURNING id`,
      [ruleSetId, versionPin ?? null, customerId],
    );
    if (!result) return res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
    return res.json({ customerId, ruleSetId, versionPin: versionPin ?? null });
  } catch (e) {
    console.error('POST /rule-sets/assign error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /rule-sets/:id/customers — which customers use this rule set ─
router.get('/rule-sets/:id/customers', requirePermission('UT_RULES_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID', code: 'VALIDATION_ERROR' });
  }
  try {
    const customers = await query(
      `SELECT id, name, rule_version_pin FROM ut.customers WHERE rule_set_id = $1 ORDER BY name`,
      [req.params.id],
    );
    return res.json(customers);
  } catch (e) {
    console.error('GET /rule-sets/:id/customers error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /versions/available?customerId= — versions for dropdown ─
// MUST be before /versions/:versionId to avoid param route capturing "available"
router.get('/versions/available', requirePermission('UT_RULES_VIEW'), async (req: Request, res: Response) => {
  const customerId = req.query.customerId as string | undefined;

  try {
    let ruleSetId: string;
    let ruleSetName: string;

    if (customerId && UUID_RE.test(customerId)) {
      const cust = await queryOne<{ rule_set_id: string | null }>(
        'SELECT rule_set_id FROM ut.customers WHERE id = $1',
        [customerId],
      );
      if (cust?.rule_set_id) {
        ruleSetId = cust.rule_set_id;
        const rs = await queryOne<{ name: string }>('SELECT name FROM ut_rules.rule_sets WHERE id = $1', [ruleSetId]);
        ruleSetName = rs?.name ?? 'unknown';
      } else {
        const rs = await queryOne<{ id: string; name: string }>(
          "SELECT id, name FROM ut_rules.rule_sets WHERE name = 'default'",
        );
        if (!rs) return res.status(404).json({ error: 'Default rule set not found' });
        ruleSetId = rs.id;
        ruleSetName = rs.name;
      }
    } else {
      const rs = await queryOne<{ id: string; name: string }>(
        "SELECT id, name FROM ut_rules.rule_sets WHERE name = 'default'",
      );
      if (!rs) return res.status(404).json({ error: 'Default rule set not found' });
      ruleSetId = rs.id;
      ruleSetName = rs.name;
    }

    const versions = await query(
      `SELECT id, version, is_latest, notes, created_at
       FROM ut_rules.rule_set_versions
       WHERE rule_set_id = $1
       ORDER BY version DESC`,
      [ruleSetId],
    );

    const latestVersion = versions.find((v: Record<string, unknown>) => v.is_latest);

    return res.json({
      ruleSetName,
      ruleSetId,
      selectedVersionId: latestVersion?.id ?? null,
      versions,
    });
  } catch (e) {
    console.error('GET /versions/available error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /versions/:versionId — full version with all rules ──────
router.get('/versions/:versionId', requirePermission('UT_RULES_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.versionId)) {
    return res.status(400).json({ error: 'Invalid version ID', code: 'VALIDATION_ERROR' });
  }
  try {
    const version = await queryOne(
      `SELECT v.id, v.rule_set_id, v.version, v.is_latest, v.notes, v.created_at, v.created_by,
              rs.name AS rule_set_name
       FROM ut_rules.rule_set_versions v
       JOIN ut_rules.rule_sets rs ON rs.id = v.rule_set_id
       WHERE v.id = $1`,
      [req.params.versionId],
    );
    if (!version) return res.status(404).json({ error: 'Version not found', code: 'NOT_FOUND' });

    const rules = await query(
      `SELECT id, category, geometry_type, sort_order, label, description, definition
       FROM ut_rules.rules WHERE version_id = $1
       ORDER BY category, sort_order`,
      [req.params.versionId],
    );

    return res.json({ ...version, rules });
  } catch (e) {
    console.error('GET /versions/:versionId error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── POST /versions/:versionId/publish — create new version ──────
const RuleSchema = z.object({
  category: z.enum(['rate', 'load_time', 'scan_formula', 'price_modifier', 'weight_formula', 'lot_calculation', 'rounding']),
  geometryType: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  label: z.string().min(1),
  description: z.string().optional(),
  definition: z.record(z.unknown()),
});

const PublishSchema = z.object({
  notes: z.string().max(500).optional(),
  rules: z.array(RuleSchema).min(1),
});

router.post('/versions/:versionId/publish', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  // RBAC stub: future role check — requires 'RULE_SET_MANAGE' permission
  // await requirePermission(req, 'RULE_SET_MANAGE');

  if (!UUID_RE.test(req.params.versionId)) {
    return res.status(400).json({ error: 'Invalid version ID', code: 'VALIDATION_ERROR' });
  }

  const parsed = PublishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  }
  const { notes, rules } = parsed.data;

  try {
    // Find the rule set from the source version
    const source = await queryOne<{ rule_set_id: string; version: number }>(
      'SELECT rule_set_id, version FROM ut_rules.rule_set_versions WHERE id = $1',
      [req.params.versionId],
    );
    if (!source) return res.status(404).json({ error: 'Source version not found', code: 'NOT_FOUND' });

    // Determine next version number
    const maxRow = await queryOne<{ max_version: number }>(
      'SELECT COALESCE(MAX(version), 0) AS max_version FROM ut_rules.rule_set_versions WHERE rule_set_id = $1',
      [source.rule_set_id],
    );
    const nextVersion = (maxRow?.max_version ?? 0) + 1;

    // Set all existing versions to not latest
    await query(
      'UPDATE ut_rules.rule_set_versions SET is_latest = false WHERE rule_set_id = $1',
      [source.rule_set_id],
    );

    // Create new version
    const newVersion = await queryOne<{ id: string }>(
      `INSERT INTO ut_rules.rule_set_versions (rule_set_id, version, is_latest, notes, created_by)
       VALUES ($1, $2, true, $3, 'system') RETURNING id`,
      [source.rule_set_id, nextVersion, notes ?? null],
    );

    // Insert all rules for new version
    for (const rule of rules) {
      await queryOne(
        `INSERT INTO ut_rules.rules (version_id, category, geometry_type, sort_order, label, description, definition)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newVersion!.id,
          rule.category,
          rule.geometryType ?? null,
          rule.sortOrder,
          rule.label,
          rule.description ?? null,
          JSON.stringify(rule.definition),
        ],
      );
    }

    // Compute diff — get old rules for comparison
    const oldRules = await query(
      'SELECT category, geometry_type, definition FROM ut_rules.rules WHERE version_id = $1 ORDER BY category, sort_order',
      [req.params.versionId],
    );
    const diff = {
      fromVersion: source.version,
      toVersion: nextVersion,
      oldRuleCount: oldRules.length,
      newRuleCount: rules.length,
      notes,
    };

    // Insert change log
    await queryOne(
      `INSERT INTO ut_rules.change_log (rule_set_id, version_from, version_to, change_type, diff, changed_by)
       VALUES ($1, $2, $3, 'update', $4, 'system')`,
      [source.rule_set_id, source.version, nextVersion, JSON.stringify(diff)],
    );

    return res.status(201).json({
      id: newVersion!.id,
      ruleSetId: source.rule_set_id,
      version: nextVersion,
      isLatest: true,
      notes,
      rulesCount: rules.length,
    });
  } catch (e) {
    console.error('POST /versions/:versionId/publish error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /versions/:v1/diff/:v2 — compare two versions ───────────
router.get('/versions/:v1/diff/:v2', requirePermission('UT_RULES_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.v1) || !UUID_RE.test(req.params.v2)) {
    return res.status(400).json({ error: 'Invalid version IDs', code: 'VALIDATION_ERROR' });
  }
  try {
    const [rules1, rules2] = await Promise.all([
      query<{ category: string; geometry_type: string | null; label: string; definition: unknown }>(
        'SELECT category, geometry_type, label, definition FROM ut_rules.rules WHERE version_id = $1 ORDER BY category, sort_order',
        [req.params.v1],
      ),
      query<{ category: string; geometry_type: string | null; label: string; definition: unknown }>(
        'SELECT category, geometry_type, label, definition FROM ut_rules.rules WHERE version_id = $1 ORDER BY category, sort_order',
        [req.params.v2],
      ),
    ]);

    // Build lookup by category+geometry for comparison
    const key = (r: { category: string; geometry_type: string | null }) =>
      `${r.category}:${r.geometry_type ?? '*'}`;

    const map1 = new Map(rules1.map(r => [key(r), r]));
    const map2 = new Map(rules2.map(r => [key(r), r]));

    const added = rules2.filter(r => !map1.has(key(r)));
    const removed = rules1.filter(r => !map2.has(key(r)));
    const changed = rules1.filter(r => {
      const other = map2.get(key(r));
      return other && JSON.stringify(r.definition) !== JSON.stringify(other.definition);
    }).map(r => ({
      key: key(r),
      label: r.label,
      v1: r.definition,
      v2: map2.get(key(r))!.definition,
    }));

    return res.json({ added, removed, changed });
  } catch (e) {
    console.error('GET /versions/:v1/diff/:v2 error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /traces — paginated trace list ───────────────────────────
router.get('/traces', requirePermission('UT_RULES_VIEW'), async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const quoteId = req.query.quoteId as string | undefined;

  try {
    let sql = `SELECT id, quote_id, rule_set_name, rule_set_version, geometry_type,
                      final_result, calculated_at, calculated_by
               FROM ut_rules.calculation_traces`;
    const params: unknown[] = [];

    if (quoteId && UUID_RE.test(quoteId)) {
      sql += ' WHERE quote_id = $1';
      params.push(quoteId);
    }

    sql += ` ORDER BY calculated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await query(sql, params);
    return res.json(rows);
  } catch (e) {
    console.error('GET /traces error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /traces/:traceId — full trace detail ─────────────────────
router.get('/traces/:traceId', requirePermission('UT_RULES_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.traceId)) {
    return res.status(400).json({ error: 'Invalid trace ID', code: 'VALIDATION_ERROR' });
  }
  try {
    const row = await queryOne(
      `SELECT * FROM ut_rules.calculation_traces WHERE id = $1`,
      [req.params.traceId],
    );
    if (!row) return res.status(404).json({ error: 'Trace not found', code: 'NOT_FOUND' });
    return res.json(row);
  } catch (e) {
    console.error('GET /traces/:traceId error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── Named Variables ──────────────────────────────────────────────
// Variable keys: lowercase letters, digits, underscores only
const VAR_KEY_RE = /^[a-z][a-z0-9_]*$/;

// Reserved keys that map to real DB columns — cannot be managed via custom_variables
const RESERVED_CUSTOMER_KEYS = new Set([
  'hourly_rate', 'cscan_rate', 'technique_fee', 'env_fee_rate',
  'min_charge', 'cscan_min_charge', 'has_env_fee', 'has_tech_fee', 'lot_pattern',
]);

const NamedVariableSchema = z.object({
  key: z.string().regex(VAR_KEY_RE, 'Key must be lowercase letters, digits, underscores; must start with a letter'),
  value: z.union([z.number(), z.string()]),
});

// ── GET /named-variables — list global + all customer custom vars ─
router.get('/named-variables', requirePermission('UT_RULES_VIEW'), async (_req: Request, res: Response) => {
  try {
    const global = await queryOne<{ custom_variables: Record<string, unknown> }>(
      'SELECT custom_variables FROM ut.global_settings LIMIT 1',
    );
    const customers = await query<{ id: string; name: string; custom_variables: Record<string, unknown> }>(
      'SELECT id, name, custom_variables FROM ut.customers ORDER BY name',
    );
    return res.json({
      global: global?.custom_variables ?? {},
      customers: customers.map(c => ({ id: c.id, name: c.name, variables: c.custom_variables ?? {} })),
    });
  } catch (e) {
    console.error('GET /named-variables error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── PUT /named-variables/global/:key — set a global named variable ─
router.put('/named-variables/global/:key', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!VAR_KEY_RE.test(key)) {
    return res.status(400).json({ error: 'Invalid variable key', code: 'VALIDATION_ERROR' });
  }
  if (RESERVED_CUSTOMER_KEYS.has(key)) {
    return res.status(400).json({ error: `'${key}' is a reserved variable name`, code: 'RESERVED_KEY' });
  }
  const parsed = z.object({ value: z.union([z.number(), z.string()]) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  }
  try {
    await query(
      `UPDATE ut.global_settings SET custom_variables = jsonb_set(COALESCE(custom_variables, '{}'), $1, $2::jsonb)`,
      [`{${key}}`, JSON.stringify(parsed.data.value)],
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('PUT /named-variables/global/:key error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── DELETE /named-variables/global/:key ─────────────────────────
router.delete('/named-variables/global/:key', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!VAR_KEY_RE.test(key)) {
    return res.status(400).json({ error: 'Invalid variable key', code: 'VALIDATION_ERROR' });
  }
  try {
    await query(
      `UPDATE ut.global_settings SET custom_variables = custom_variables - $1`,
      [key],
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /named-variables/global/:key error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── PUT /named-variables/customer/:customerId/:key ───────────────
router.put('/named-variables/customer/:customerId/:key', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.customerId)) {
    return res.status(400).json({ error: 'Invalid customer ID', code: 'VALIDATION_ERROR' });
  }
  const { key } = req.params;
  if (!VAR_KEY_RE.test(key)) {
    return res.status(400).json({ error: 'Invalid variable key', code: 'VALIDATION_ERROR' });
  }
  if (RESERVED_CUSTOMER_KEYS.has(key)) {
    return res.status(400).json({ error: `'${key}' is a reserved variable name`, code: 'RESERVED_KEY' });
  }
  const parsed = z.object({ value: z.union([z.number(), z.string()]) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  }
  try {
    const result = await query(
      `UPDATE ut.customers SET custom_variables = jsonb_set(COALESCE(custom_variables, '{}'), $1, $2::jsonb) WHERE id = $3`,
      [`{${key}}`, JSON.stringify(parsed.data.value), req.params.customerId],
    );
    if ((result as unknown as { rowCount: number }).rowCount === 0) {
      return res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('PUT /named-variables/customer/:customerId/:key error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── DELETE /named-variables/customer/:customerId/:key ────────────
router.delete('/named-variables/customer/:customerId/:key', requirePermission('UT_RULES_MANAGE'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.customerId)) {
    return res.status(400).json({ error: 'Invalid customer ID', code: 'VALIDATION_ERROR' });
  }
  const { key } = req.params;
  if (!VAR_KEY_RE.test(key)) {
    return res.status(400).json({ error: 'Invalid variable key', code: 'VALIDATION_ERROR' });
  }
  try {
    await query(
      `UPDATE ut.customers SET custom_variables = custom_variables - $1 WHERE id = $2`,
      [key, req.params.customerId],
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /named-variables/customer/:customerId/:key error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
