/**
 * UT Calculate endpoint — performs calculation using the rule engine.
 * Does NOT create a quote — just returns results + trace.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryOne } from '../db';
import { requirePermission } from '../middleware/requirePermission';
import { resolveRuleSetVersion, executeCalculation, type DbCustomerForRules, type DbMaterialForRules, type Dims } from '../calculations/rule-engine';
import { persistTrace } from '../calculations/trace-logger';
import type { GeometryType, InspectionClass } from '../types/quote';
import { rateForGeometry, defaultLoadTime, type DbCustomer } from '../calculations/ut';

const router = Router();

const CalculateSchema = z.object({
  customerId: z.string().uuid(),
  geometryType: z.enum(['FLAT_BAR', 'ROUND_BAR', 'RING', 'TUBING', 'CSCAN_FLAT', 'CSCAN_ROUND', 'THIN_SHEET']),
  dims: z.object({
    thickness: z.number().nonnegative().default(0),
    width: z.number().nonnegative().default(0),
    length: z.number().nonnegative().default(0),
    diameter: z.number().nonnegative().default(0),
    od: z.number().nonnegative().default(0),
    id_: z.number().nonnegative().default(0),
    numScans: z.number().int().positive().default(1),
  }),
  scanIndex: z.number().positive().default(0.065),
  quantity: z.number().int().positive().default(1),
  ruleSetVersionId: z.string().uuid().optional(),
  useWeightPricing: z.boolean().default(false),
  materialId: z.string().uuid().optional(),
  inspectionClass: z.enum(['A', 'AA']).default('A'),
  persistTrace: z.boolean().default(false),
});

router.post('/', requirePermission('UT_CALCULATE'), async (req: Request, res: Response) => {
  const parsed = CalculateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data;

  try {
    // Resolve customer
    const customer = await queryOne<DbCustomer & { rule_set_id: string | null; rule_version_pin: number | null }>(
      `SELECT id, name, hourly_rate, cscan_rate, technique_fee, env_fee_rate,
              min_charge, cscan_min_charge, delivery_fee, lead_time,
              has_env_fee, has_tech_fee, lot_pattern, rule_set_id, rule_version_pin
       FROM ut.customers WHERE id = $1 AND is_active = true`,
      [input.customerId],
    );
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    // Resolve settings
    const settings = await queryOne<{ scan_speed_divisor: number }>(
      'SELECT scan_speed_divisor FROM ut.global_settings LIMIT 1',
    );
    const scanSpeedDivisor = settings?.scan_speed_divisor ?? 10;

    // Resolve material if weight pricing
    let material: DbMaterialForRules | undefined;
    if (input.useWeightPricing && input.materialId) {
      material = await queryOne<DbMaterialForRules>(
        'SELECT id, density_lb_per_cu_in, class_a_rate_per_lb, class_aa_rate_per_lb FROM ut.materials WHERE id = $1',
        [input.materialId],
      ) ?? undefined;
      if (!material) {
        return res.status(404).json({ error: 'Material not found', code: 'MATERIAL_NOT_FOUND' });
      }
    }

    // Resolve rule set version
    const resolved = await resolveRuleSetVersion(input.customerId, input.ruleSetVersionId);

    // Determine rates
    const geo = input.geometryType as GeometryType;
    const isCScan = geo === 'CSCAN_FLAT' || geo === 'CSCAN_ROUND';
    const loadTime = defaultLoadTime(geo);
    const hourlyRate = rateForGeometry(geo, customer);

    const dims: Dims = input.dims;

    // Execute calculation
    const customerForRules: DbCustomerForRules = {
      id: customer.id,
      hourly_rate: Number(customer.hourly_rate),
      cscan_rate: Number(customer.cscan_rate),
      technique_fee: Number(customer.technique_fee),
      env_fee_rate: Number(customer.env_fee_rate),
      min_charge: Number(customer.min_charge),
      cscan_min_charge: Number(customer.cscan_min_charge),
      has_env_fee: customer.has_env_fee,
      has_tech_fee: customer.has_tech_fee,
      lot_pattern: customer.lot_pattern,
      rule_set_id: customer.rule_set_id,
      rule_version_pin: customer.rule_version_pin,
    };

    const result = await executeCalculation(
      resolved.versionId, geo, dims, input.scanIndex, loadTime, hourlyRate,
      scanSpeedDivisor, input.quantity, customerForRules, isCScan,
      material, input.inspectionClass as InspectionClass, input.useWeightPricing,
    );

    // Optionally persist trace
    let traceId: string | undefined;
    if (input.persistTrace) {
      traceId = await persistTrace(result.trace);
    }

    return res.json({
      scanResult: result.scan,
      weightResult: result.weight,
      lotResult: result.lot,
      ruleSetName: resolved.ruleSetName,
      ruleSetVersion: resolved.version,
      ruleSetVersionId: resolved.versionId,
      traceId,
      trace: result.trace,
    });
  } catch (e) {
    console.error('POST /calculate error', e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Calculation failed',
      code: 'CALCULATION_ERROR',
    });
  }
});

export default router;
