/**
 * UT Rule Engine — evaluates DB-stored rules instead of hardcoded formulas.
 * Produces a full calculation trace for every computation.
 */

import { query, queryOne } from '../db';
import { evaluateExpression } from './expression-evaluator';
import type { EvalContext } from './expression-evaluator';
import type { GeometryType, InspectionClass } from '../types/quote';

// ── Types ────────────────────────────────────────────────────────

export interface DbCustomerForRules {
  id: string;  // required for custom_variables lookup
  hourly_rate: number;
  cscan_rate: number;
  technique_fee: number;
  env_fee_rate: number;
  min_charge: number;
  cscan_min_charge: number;
  has_env_fee: boolean;
  has_tech_fee: boolean;
  lot_pattern: 'simple' | 'min_enforced';
  rule_set_id: string | null;
  rule_version_pin: number | null;
  misc_fee?: number | null;
}

export interface DbMaterialForRules {
  id: string;
  name: string;
  density_lb_per_cu_in: number;
  class_a_rate_per_lb: number | null;
  class_aa_rate_per_lb: number | null;
}

export interface Dims {
  thickness: number;
  width: number;
  length: number;
  diameter: number;
  od: number;
  id_: number;
  numScans: number;
  numODScans?: number;
  numFaceScans?: number;
}

export interface TraceStep {
  stepIndex: number;
  ruleName: string;
  ruleCategory: string;
  expression: string;
  namedInputs: Record<string, number | string | boolean | null>;
  result: number;
}

export interface ScanResult {
  indexes: number;
  secPerScanline: number;
  scanTimeMin: number;
  scanTimeFaceMin: number;
  totalTimeMin: number;
  pricePart: number;
}

export interface WeightResult {
  cubicInches: number;
  weight: number;
  weightPrice: number;
}

export interface LotResult {
  extPrice: number;
  lotCharge: number;
  techFee: number;
  miscFee: number;
  subTotal: number;
  envFee: number;
  grandTotal: number;
}

export interface CalculationTrace {
  ruleSetName: string;
  ruleSetVersion: number;
  ruleSetVersionId: string;
  geometryType: string;
  inputs: Record<string, unknown>;
  steps: TraceStep[];
  scanResult: ScanResult;
  weightResult: WeightResult | null;
  lotResult: LotResult;
  finalResult: { pricePart: number; grandTotal: number };
}

export interface RuleEngineResult {
  scan: ScanResult;
  weight: WeightResult | null;
  lot: LotResult;
  trace: CalculationTrace;
}

export interface ResolvedVersion {
  ruleSetId: string;
  ruleSetName: string;
  versionId: string;
  version: number;
}

interface RuleRow {
  id: string;
  category: string;
  geometry_type: string | null;
  sort_order: number;
  label: string;
  definition: RuleDefinition;
}

interface LookupDefinition {
  type: 'lookup';
  key: string;
  table: Record<string, number | { value?: number; source?: string }>;
}

interface FormulaStep {
  name: string;
  expr: string;
  condition?: string;
}

interface FormulaDefinition {
  type: 'formula';
  geometry?: string;
  steps: FormulaStep[];
  geometry_groups?: Record<string, string[]>;
}

interface FunctionDefinition {
  type: 'function';
  name: string;
  expr: string;
}

type RuleDefinition = LookupDefinition | FormulaDefinition | FunctionDefinition;

// ── Load Rules ───────────────────────────────────────────────────

export async function loadRuleSet(versionId: string): Promise<RuleRow[]> {
  const rows = await query<RuleRow>(
    `SELECT id, category, geometry_type, sort_order, label, definition
     FROM ut_rules.rules
     WHERE version_id = $1
     ORDER BY category, sort_order`,
    [versionId],
  );
  return rows;
}

// ── Resolve Version ──────────────────────────────────────────────

export async function resolveRuleSetVersion(
  customerId: string,
  versionOverride?: string,
): Promise<ResolvedVersion> {
  // If explicit version override, use it directly
  if (versionOverride) {
    const row = await queryOne<{
      id: string; version: number; rule_set_id: string; rs_name: string;
    }>(
      `SELECT v.id, v.version, v.rule_set_id, rs.name AS rs_name
       FROM ut_rules.rule_set_versions v
       JOIN ut_rules.rule_sets rs ON rs.id = v.rule_set_id
       WHERE v.id = $1`,
      [versionOverride],
    );
    if (!row) throw new Error(`Rule set version not found: ${versionOverride}`);
    return { ruleSetId: row.rule_set_id, ruleSetName: row.rs_name, versionId: row.id, version: row.version };
  }

  // Check customer for rule_set_id / version pin
  const customer = await queryOne<{
    rule_set_id: string | null; rule_version_pin: number | null;
  }>(
    'SELECT rule_set_id, rule_version_pin FROM ut.customers WHERE id = $1',
    [customerId],
  );

  let ruleSetId: string;
  let pinVersion: number | null = null;

  if (customer?.rule_set_id) {
    ruleSetId = customer.rule_set_id;
    pinVersion = customer.rule_version_pin;
  } else {
    // Fall back to "default" rule set
    const defaultRs = await queryOne<{ id: string }>(`SELECT id FROM ut_rules.rule_sets WHERE name = 'default'`);
    if (!defaultRs) throw new Error('Default rule set not found');
    ruleSetId = defaultRs.id;
  }

  // Resolve version: pinned or latest
  let versionRow: { id: string; version: number; rs_name: string } | null;

  if (pinVersion !== null) {
    versionRow = await queryOne<{ id: string; version: number; rs_name: string }>(
      `SELECT v.id, v.version, rs.name AS rs_name
       FROM ut_rules.rule_set_versions v
       JOIN ut_rules.rule_sets rs ON rs.id = v.rule_set_id
       WHERE v.rule_set_id = $1 AND v.version = $2`,
      [ruleSetId, pinVersion],
    );
  } else {
    versionRow = await queryOne<{ id: string; version: number; rs_name: string }>(
      `SELECT v.id, v.version, rs.name AS rs_name
       FROM ut_rules.rule_set_versions v
       JOIN ut_rules.rule_sets rs ON rs.id = v.rule_set_id
       WHERE v.rule_set_id = $1 AND v.is_latest = true`,
      [ruleSetId],
    );
  }

  if (!versionRow) throw new Error(`No rule set version found for rule_set_id=${ruleSetId}`);

  return {
    ruleSetId,
    ruleSetName: versionRow.rs_name,
    versionId: versionRow.id,
    version: versionRow.version,
  };
}

// ── Execute Calculation ──────────────────────────────────────────

export async function executeCalculation(
  versionId: string,
  geo: GeometryType,
  dims: Dims,
  scanIndex: number,
  loadTime: number,
  hourlyRate: number,
  scanSpeedDivisor: number,
  quantity: number,
  customer: DbCustomerForRules,
  isCScan: boolean,
  material?: DbMaterialForRules,
  inspClass?: InspectionClass,
  useWeightPricing?: boolean,
): Promise<RuleEngineResult> {
  const rules = await loadRuleSet(versionId);
  const steps: TraceStep[] = [];
  let stepIndex = 0;

  // Get version info for trace
  const versionInfo = await queryOne<{ version: number; rs_name: string }>(
    `SELECT v.version, rs.name AS rs_name
     FROM ut_rules.rule_set_versions v
     JOIN ut_rules.rule_sets rs ON rs.id = v.rule_set_id
     WHERE v.id = $1`,
    [versionId],
  );

  // Load custom variables: global as base, customer overrides
  const globalSettings = await queryOne<{ custom_variables: Record<string, unknown> }>(
    'SELECT custom_variables FROM ut.global_settings LIMIT 1',
  );
  const customerCustomVars = await queryOne<{ custom_variables: Record<string, unknown> }>(
    'SELECT custom_variables FROM ut.customers WHERE id = $1',
    [customer.id],
  );
  const customVars = {
    ...(globalSettings?.custom_variables ?? {}),
    ...(customerCustomVars?.custom_variables ?? {}),
  };

  // Build evaluation context
  const ctx: EvalContext = {
    dims: {
      thickness: dims.thickness,
      width: dims.width,
      length: dims.length,
      diameter: dims.diameter,
      od: dims.od,
      id_: dims.id_,
      numScans: dims.numScans,
      numODScans: dims.numODScans ?? 1,
      numFaceScans: dims.numFaceScans ?? 1,
    },
    scanIndex,
    loadTime,
    hourlyRate,
    scanSpeedDivisor,
    geo,
    customer: {
      // Custom variables first (lowest precedence), then real DB columns override
      ...customVars,
      hourly_rate: customer.hourly_rate,
      cscan_rate: customer.cscan_rate,
      technique_fee: customer.technique_fee,
      env_fee_rate: customer.env_fee_rate,
      min_charge: customer.min_charge,
      cscan_min_charge: customer.cscan_min_charge,
      has_env_fee: customer.has_env_fee,
      has_tech_fee: customer.has_tech_fee,
      lot_pattern: customer.lot_pattern,
      misc_fee: customer.misc_fee ?? 0,
    },
    material: material ? {
      density_lb_per_cu_in: material.density_lb_per_cu_in,
      class_a_rate_per_lb: material.class_a_rate_per_lb,
      class_aa_rate_per_lb: material.class_aa_rate_per_lb,
    } : null,
    inspClass: inspClass ?? 'A',
    isCScan,
    qty: quantity,
    // Boolean helpers for lot calculation ternaries
    lotPattern_min_enforced: customer.lot_pattern === 'min_enforced',
    has_tech_fee: customer.has_tech_fee,
    has_env_fee: customer.has_env_fee,
  };

  function addStep(name: string, category: string, expr: string, result: number) {
    const relevantInputs: Record<string, number | string | boolean | null> = {};
    // Extract referenced variables from context for the trace
    const identifiers = expr.match(/[a-zA-Z_][a-zA-Z0-9_.]*/g) || [];
    for (const ident of identifiers) {
      if (['CEIL', 'FLOOR', 'MAX', 'MIN', 'POW', 'ABS', 'ROUNDUP1', 'PI', 'true', 'false'].includes(ident)) continue;
      const val = resolveCtxValue(ctx, ident);
      if (val !== undefined) {
        relevantInputs[ident] = val as number | string | boolean | null;
      }
    }
    steps.push({ stepIndex: stepIndex++, ruleName: name, ruleCategory: category, expression: expr, namedInputs: relevantInputs, result });
    // Add result to context for subsequent steps
    (ctx as Record<string, unknown>)[name] = result;
  }

  // ── 1. Evaluate scan formula ──
  const scanRule = findRule(rules, 'scan_formula', geo);
  if (!scanRule) throw new Error(`No scan_formula rule found for geometry: ${geo}`);

  const scanDef = scanRule.definition as FormulaDefinition;
  for (const step of scanDef.steps) {
    const result = evaluateExpression(step.expr, ctx);
    addStep(step.name, 'scan_formula', step.expr, result);
  }

  // ── 2. Evaluate price modifier ──
  const priceRule = findRule(rules, 'price_modifier', geo) ?? findRule(rules, 'price_modifier', '*');
  if (!priceRule) throw new Error(`No price_modifier rule found for geometry: ${geo}`);

  const priceDef = priceRule.definition as FormulaDefinition;
  for (const step of priceDef.steps) {
    const result = evaluateExpression(step.expr, ctx);
    addStep(step.name, 'price_modifier', step.expr, result);
  }

  const pricePart = (ctx as Record<string, unknown>).pricePart as number;

  const scanResult: ScanResult = {
    indexes: (ctx as Record<string, unknown>).indexes as number ?? 0,
    secPerScanline: (ctx as Record<string, unknown>).secPerScanline as number ?? 0,
    scanTimeMin: (ctx as Record<string, unknown>).scanTimeMin as number ?? 0,
    scanTimeFaceMin: (ctx as Record<string, unknown>).scanTimeFaceMin as number ?? 0,
    totalTimeMin: (ctx as Record<string, unknown>).totalTimeMin as number ?? 0,
    pricePart,
  };

  // ── 3. Evaluate weight formula (if applicable) ──
  let weightResult: WeightResult | null = null;
  let effectivePricePart = pricePart;

  if (useWeightPricing && material) {
    const weightRule = findRule(rules, 'weight_formula', null);
    if (weightRule) {
      const weightDef = weightRule.definition as FormulaDefinition;
      const geoGroups = weightDef.geometry_groups ?? { flat: [], round: [] };

      // Set geometry group booleans in context
      (ctx as Record<string, unknown>).geo_in_flat = (geoGroups.flat ?? []).includes(geo);
      (ctx as Record<string, unknown>).geo_in_round = (geoGroups.round ?? []).includes(geo);

      for (const step of weightDef.steps) {
        // Handle conditional steps: only evaluate if condition matches
        if (step.condition) {
          const condVal = (ctx as Record<string, unknown>)[step.condition];
          if (!condVal) {
            // Set to 0 and skip
            (ctx as Record<string, unknown>)[step.name] = 0;
            continue;
          }
        }
        const result = evaluateExpression(step.expr, ctx);
        addStep(step.name, 'weight_formula', step.expr, result);
      }

      const cubicInches = ((ctx as Record<string, unknown>).cubicInches as number) ?? 0;
      const weight = ((ctx as Record<string, unknown>).weight as number) ?? 0;
      const weightPrice = ((ctx as Record<string, unknown>).weightPrice as number) ?? 0;

      weightResult = { cubicInches, weight, weightPrice };
      effectivePricePart = Math.max(pricePart, weightPrice);
    }
  }

  // Update pricePart in context to the effective (MAX) value
  (ctx as Record<string, unknown>).pricePart = effectivePricePart;

  // ── 4. Evaluate lot calculation ──
  const lotRule = findRule(rules, 'lot_calculation', null);
  if (!lotRule) throw new Error('No lot_calculation rule found');

  const lotDef = lotRule.definition as FormulaDefinition;
  for (const step of lotDef.steps) {
    const result = evaluateExpression(step.expr, ctx);
    addStep(step.name, 'lot_calculation', step.expr, result);
  }

  const lotResult: LotResult = {
    extPrice: (ctx as Record<string, unknown>).extPrice as number ?? 0,
    lotCharge: (ctx as Record<string, unknown>).lotCharge as number ?? 0,
    techFee: (ctx as Record<string, unknown>).techFee as number ?? 0,
    miscFee: (ctx as Record<string, unknown>).miscFee as number ?? 0,
    subTotal: (ctx as Record<string, unknown>).subTotal as number ?? 0,
    envFee: (ctx as Record<string, unknown>).envFee as number ?? 0,
    grandTotal: (ctx as Record<string, unknown>).grandTotal as number ?? 0,
  };

  // ── Build trace ──
  const trace: CalculationTrace = {
    ruleSetName: versionInfo?.rs_name ?? 'unknown',
    ruleSetVersion: versionInfo?.version ?? 0,
    ruleSetVersionId: versionId,
    geometryType: geo,
    inputs: {
      dims, scanIndex, loadTime, hourlyRate, scanSpeedDivisor,
      quantity, isCScan, useWeightPricing: useWeightPricing ?? false,
      inspClass: inspClass ?? null,
    },
    steps,
    scanResult,
    weightResult,
    lotResult,
    finalResult: { pricePart: effectivePricePart, grandTotal: lotResult.grandTotal },
  };

  return { scan: scanResult, weight: weightResult, lot: lotResult, trace };
}

// ── Helpers ──────────────────────────────────────────────────────

function findRule(rules: RuleRow[], category: string, geometry: string | null): RuleRow | undefined {
  // First try exact geometry match
  if (geometry) {
    const exact = rules.find(r => r.category === category && r.geometry_type === geometry);
    if (exact) return exact;
  }
  // Fall back to wildcard or null geometry
  return rules.find(r => r.category === category && (r.geometry_type === '*' || r.geometry_type === null));
}

function resolveCtxValue(ctx: EvalContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = ctx;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
