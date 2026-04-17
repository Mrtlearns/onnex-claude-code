import fs from 'node:fs/promises';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/requirePermission';
import { query, queryOne } from '../db';
import { generatePdf, storePdf, buildHtmlDocument, buildUtQuoteHtml, fmtMoney, type UtQuotePdfData } from '../lib/pdfGenerator';
import {
  computeScan, computeWeight, computeLot,
  rateForGeometry, defaultLoadTime,
  type DbCustomer, type DbMaterial, type Dims,
} from '../calculations/ut';
import { resolveRuleSetVersion, executeCalculation, type DbCustomerForRules } from '../calculations/rule-engine';
import { persistTrace } from '../calculations/trace-logger';
import type {
  UtQuoteRequest, UtQuoteResponse, UtQuoteLineResult,
  UtQuoteCustomerSnapshot, UtQuoteSummary,
} from '../types/quote';

const USE_RULE_ENGINE = process.env.USE_RULE_ENGINE !== 'false';

const router = Router();

// ── Zod validation schema ─────────────────────────────────────
const LineSchema = z.object({
  partNumber:        z.string().optional(),
  description:       z.string().optional(),
  geometryType:      z.enum(['FLAT_BAR','ROUND_BAR','RING','TUBING','CSCAN_FLAT','CSCAN_ROUND','THIN_SHEET','SQUARE_RECT_TUBE']),
  thickness:         z.number().positive().optional(),
  width:             z.number().positive().optional(),
  length:            z.number().positive().optional(),
  diameter:          z.number().positive().optional(),
  outerDiameter:     z.number().positive().optional(),
  innerDiameter:     z.number().positive().optional(),
  scanIndex:         z.number().positive().optional().default(0.065),
  loadTime:          z.number().nonnegative().optional(),
  quantity:          z.number().int().positive(),
  numberOfScans:     z.number().int().positive().optional().default(1),
  numODScans:        z.number().int().positive().optional().default(1),
  numFaceScans:      z.number().int().positive().optional().default(1),
  hourlyRateOverride:z.number().positive().optional(),
  useWeightPricing:  z.boolean().optional().default(false),
  materialId:        z.string().uuid().optional(),
  inspectionClass:   z.enum(['A','AA']).optional().default('A'),
}).superRefine((data, ctx) => {
  const geo = data.geometryType;
  const require = (field: string, val: number | undefined) => {
    if (val === undefined || val === null || val <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} is required and must be > 0 for geometry type ${geo}`,
      });
    }
  };

  if (['FLAT_BAR', 'CSCAN_FLAT', 'THIN_SHEET', 'SQUARE_RECT_TUBE'].includes(geo)) {
    require('thickness', data.thickness);
    require('width', data.width);
    require('length', data.length);
  } else if (['ROUND_BAR', 'CSCAN_ROUND'].includes(geo)) {
    require('diameter', data.diameter);
    require('length', data.length);
  } else if (geo === 'RING') {
    require('outerDiameter', data.outerDiameter);
    require('innerDiameter', data.innerDiameter);
    require('length', data.length);
    if (
      data.outerDiameter !== undefined && data.innerDiameter !== undefined &&
      data.outerDiameter > 0 && data.innerDiameter > 0 &&
      data.outerDiameter <= data.innerDiameter
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['outerDiameter'],
        message: 'outerDiameter must be greater than innerDiameter',
      });
    }
  } else if (geo === 'TUBING') {
    require('diameter', data.diameter);
    require('length', data.length);
  }
});

const QuoteSchema = z.object({
  customerId:   z.string().uuid().optional(),
  customerName: z.string().optional(),
  items:        z.array(LineSchema).min(1).max(50),
  requestedBy:  z.string().optional(),
  externalRef:  z.string().optional(),
  source:       z.enum(['api','salesforce','email','portal']).optional().default('api'),
  notes:        z.string().optional(),
  standard:     z.string().max(150).optional(),
  rushLevel:    z.enum(['normal','expedited']).optional().default('normal'),
  ruleSetVersionId: z.string().uuid().optional(),
}).refine(d => d.customerId || d.customerName, {
  message: 'Either customerId or customerName is required',
});

// ── POST /quote ───────────────────────────────────────────────
router.post('/', requirePermission('UT_QUOTE_CREATE'), async (req: Request, res: Response) => {
  // 1. Validate input
  const parsed = QuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data as UtQuoteRequest;

  // 2. Resolve customer
  let customer: DbCustomer | null = null;
  if (input.customerId) {
    customer = await queryOne<DbCustomer>(
      'SELECT * FROM ut.customers WHERE id = $1 AND is_active = true',
      [input.customerId]
    );
  } else if (input.customerName) {
    customer = await queryOne<DbCustomer>(
      'SELECT * FROM ut.customers WHERE LOWER(name) = LOWER($1) AND is_active = true',
      [input.customerName]
    );
  }
  if (!customer) {
    return res.status(404).json({
      error: `Customer not found: ${input.customerId ?? input.customerName}`,
      code: 'CUSTOMER_NOT_FOUND',
    });
  }

  // 3. Fetch settings (scan speed divisor)
  const settings = await queryOne<{ scan_speed_divisor: number }>(
    'SELECT scan_speed_divisor FROM ut.global_settings LIMIT 1'
  );
  const scanSpeedDivisor = settings?.scan_speed_divisor ?? 10;

  // 4. Resolve rule set version (if rule engine enabled)
  let resolved: { ruleSetId: string; ruleSetName: string; versionId: string; version: number } | null = null;
  if (USE_RULE_ENGINE) {
    try {
      resolved = await resolveRuleSetVersion(customer.id, input.ruleSetVersionId);
    } catch (e) {
      console.warn('Rule engine version resolution failed, falling back to hardcoded', e);
    }
  }

  // 5. Process each line item
  const lineResults: UtQuoteLineResult[] = [];
  const traceIds: string[] = [];

  for (const item of input.items) {
    // Resolve material if needed
    let material: DbMaterial | null = null;
    if (item.useWeightPricing && item.materialId) {
      material = await queryOne<DbMaterial>(
        'SELECT * FROM ut.materials WHERE id = $1', [item.materialId]
      );
      if (!material) {
        return res.status(404).json({
          error: `Material not found: ${item.materialId}`,
          code: 'MATERIAL_NOT_FOUND',
        });
      }
    }

    const geo = item.geometryType;
    const isCScan = geo === 'CSCAN_FLAT' || geo === 'CSCAN_ROUND';
    const loadTime = item.loadTime ?? defaultLoadTime(geo);
    const hourlyRate = item.hourlyRateOverride ?? rateForGeometry(geo, customer);
    const scanIndex = item.scanIndex ?? 0.065;
    const numScans = item.numberOfScans ?? 1;

    const dims: Dims = {
      thickness:    item.thickness ?? 0,
      width:        item.width ?? 0,
      length:       item.length ?? 0,
      diameter:     item.diameter ?? 0,
      od:           item.outerDiameter ?? 0,
      id_:          item.innerDiameter ?? 0,
      numScans,
      numODScans:   item.numODScans ?? 1,
      numFaceScans: item.numFaceScans ?? 1,
    };

    let scan: { indexes: number; secPerScanline: number; scanTimeMin: number; scanTimeFaceMin: number; totalTimeMin: number; pricePart: number } | undefined;
    let weightPricePart: number | null = null;
    let effectivePricePart = 0;
    let lot: { extPrice: number; lotCharge: number; techFee: number; miscFee: number; subTotal: number; envFee: number; grandTotal: number } | undefined;

    let engineFailed = false;
    if (resolved) {
      // ── Rule engine path ──
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
        misc_fee: Number(customer.misc_fee ?? 0),
        rule_set_id: null,
        rule_version_pin: null,
      };

      try {
        const engineResult = await executeCalculation(
          resolved.versionId, geo, dims, scanIndex, loadTime, hourlyRate,
          scanSpeedDivisor, item.quantity, customerForRules, isCScan,
          material ? { id: material.id, name: material.name, density_lb_per_cu_in: material.density_lb_per_cu_in, class_a_rate_per_lb: material.class_a_rate_per_lb, class_aa_rate_per_lb: material.class_aa_rate_per_lb } : undefined,
          item.inspectionClass ?? 'A',
          item.useWeightPricing,
        );
        scan = engineResult.scan;
        weightPricePart = engineResult.weight?.weightPrice ?? null;
        effectivePricePart = engineResult.trace.finalResult.pricePart;
        lot = engineResult.lot;
      } catch (e) {
        console.warn('[quote] Rule engine calculation failed, falling back to hardcoded:', e);
        engineFailed = true;
      }
    }

    if (!resolved || engineFailed) {
      // ── Legacy hardcoded path ──
      scan = computeScan(geo, dims, scanIndex, loadTime, hourlyRate, scanSpeedDivisor);

      if (item.useWeightPricing && material) {
        const wr = computeWeight(geo, dims, material, item.inspectionClass ?? 'A');
        weightPricePart = wr.weightPrice;
      }

      effectivePricePart = (weightPricePart !== null)
        ? Math.max(scan.pricePart, weightPricePart)
        : scan.pricePart;

      lot = computeLot(effectivePricePart, item.quantity, customer, isCScan);
    }

    lineResults.push({
      partNumber:   item.partNumber,
      description:  item.description,
      geometryType: geo,
      dimensions: {
        thickness:      item.thickness,
        width:          item.width,
        length:         item.length,
        diameter:       item.diameter,
        outerDiameter:  item.outerDiameter,
        innerDiameter:  item.innerDiameter,
        numScans:       numScans > 1 ? numScans : undefined,
      },
      scanParameters: {
        scanIndex,
        loadTime,
        hourlyRate,
        indexes:        scan!.indexes,
        secPerScanline: parseFloat(scan!.secPerScanline.toFixed(4)),
        scanTimeMin:    parseFloat(scan!.scanTimeMin.toFixed(4)),
        totalTimeMin:   parseFloat(scan!.totalTimeMin.toFixed(4)),
      },
      pricing: {
        timePricePart:      scan!.pricePart,
        weightPricePart,
        effectivePricePart,
        quantity:           item.quantity,
        extPrice:           lot!.extPrice,
        lotCharge:          lot!.lotCharge,
        techFee:            lot!.techFee,
        subTotal:           lot!.subTotal,
        envFee:             lot!.envFee,
        grandTotal:         lot!.grandTotal,
      },
    });
  }

  // 5. Build summary
  const baseGrand = parseFloat(lineResults.reduce((s, r) => s + r.pricing.grandTotal, 0).toFixed(2));
  const rushLevel = (input.rushLevel ?? 'normal') as 'normal' | 'expedited';
  const rushMultiplier = rushLevel === 'expedited' ? 1.25 : 1.00;
  const rushSurcharge = parseFloat((baseGrand * (rushMultiplier - 1)).toFixed(2));
  const totalGrand = parseFloat((baseGrand * rushMultiplier).toFixed(2));

  const summary: UtQuoteSummary = {
    itemCount:     lineResults.length,
    totalParts:    input.items.reduce((s, i) => s + i.quantity, 0),
    totalGrand,
    totalTechFees: parseFloat(lineResults.reduce((s, r) => s + r.pricing.techFee, 0).toFixed(2)),
    totalEnvFees:  parseFloat(lineResults.reduce((s, r) => s + r.pricing.envFee, 0).toFixed(2)),
    deliveryFee:   customer.delivery_fee,
    leadTime:      customer.lead_time,
    rushLevel,
    rushMultiplier,
    rushSurcharge,
  };

  const customerSnapshot: UtQuoteCustomerSnapshot = {
    id:           customer.id,
    name:         customer.name,
    hourlyRate:   customer.hourly_rate,
    cScanRate:    customer.cscan_rate,
    minCharge:    customer.min_charge,
    techniqueFee: customer.technique_fee,
    hasEnvFee:    customer.has_env_fee,
    hasTechFee:   customer.has_tech_fee,
    lotPattern:   customer.lot_pattern,
    deliveryFee:  customer.delivery_fee,
    leadTime:     customer.lead_time,
  };

  // 6. Persist to DB and get auto-generated quote number
  const saved = await queryOne<{ id: string; quote_number: string }>(
    `INSERT INTO ut.incoming_quotes
       (source, external_ref, requested_by, customer_id, customer_name,
        status, request_body, response_body, grand_total,
        standard, rush_level, rush_multiplier, rush_surcharge,
        rule_set_version_id)
     VALUES ($1,$2,$3,$4,$5,'calculated',$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, quote_number`,
    [
      input.source ?? 'api',
      input.externalRef ?? null,
      input.requestedBy ?? null,
      customer.id,
      customer.name,
      JSON.stringify(input),
      JSON.stringify({ items: lineResults, summary }),
      summary.totalGrand,
      input.standard ?? null,
      rushLevel,
      rushMultiplier,
      rushSurcharge,
      resolved?.versionId ?? null,
    ]
  );

  const response: UtQuoteResponse & { ruleSetVersionId?: string; ruleSetName?: string; ruleSetVersion?: number } = {
    quoteId:     saved!.id,
    quoteNumber: saved!.quote_number,
    generatedAt: new Date().toISOString(),
    customer:    customerSnapshot,
    items:       lineResults,
    summary,
    source:      (input.source ?? 'api') as UtQuoteResponse['source'],
    externalRef: input.externalRef,
    requestedBy: input.requestedBy,
    notes:       input.notes,
    standard:    input.standard,
    rushLevel,
    ...(resolved ? {
      ruleSetVersionId: resolved.versionId,
      ruleSetName: resolved.ruleSetName,
      ruleSetVersion: resolved.version,
    } : {}),
  };

  return res.status(201).json(response);
});

// ── GET /quote/health ────────────────────────────────────────
router.get('/health', requirePermission('UT_VIEW'), (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ndt-ut-api', time: new Date().toISOString() });
});

// ── GET /quote/:id ────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.get('/:id', requirePermission('UT_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid quote ID format', code: 'VALIDATION_ERROR' });
  }
  try {
    const row = await queryOne(
      `SELECT id, quote_number, source, customer_name, status,
              response_body, grand_total, created_at, intake_id::text,
              pdf_version, pdf_path,
              standard, rush_level, rush_multiplier, rush_surcharge
       FROM ut.incoming_quotes WHERE id = $1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
    return res.json(row);
  } catch (e) {
    console.error('GET /:id error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /quote (list recent) ──────────────────────────────────
router.get('/', requirePermission('UT_VIEW'), async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT id, quote_number, customer_name, source, grand_total, status, created_at, intake_id::text
     FROM ut.incoming_quotes ORDER BY created_at DESC LIMIT 50`
  );
  return res.json(rows);
});

// ── PUT /quote/:id ────────────────────────────────────────────
router.put('/:id', requirePermission('UT_QUOTE_CREATE'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid quote ID format', code: 'VALIDATION_ERROR' });
  }
  const { customerName, status } = req.body as { customerName?: string; status?: string };
  const allowed = ['calculated','pending','sent','accepted','rejected'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status', code: 'VALIDATION_ERROR' });
  }
  try {
    const existing = await queryOne<{ customer_name: string; status: string; pdf_version: number }>(
      'SELECT customer_name, status, pdf_version FROM ut.incoming_quotes WHERE id = $1',
      [req.params.id],
    );
    if (!existing) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    if (customerName !== undefined && customerName !== existing.customer_name) diff.customerName = { from: existing.customer_name, to: customerName };
    if (status !== undefined && status !== existing.status) diff.status = { from: existing.status, to: status };

    const updated = await queryOne<{ id: string; quote_number: string; status: string; pdf_version: number }>(
      `UPDATE ut.incoming_quotes
       SET customer_name = COALESCE($1, customer_name),
           status        = COALESCE($2, status)
       WHERE id = $3
       RETURNING id, quote_number, status, pdf_version`,
      [customerName ?? null, status ?? null, req.params.id],
    );

    await queryOne(
      `INSERT INTO app.quote_audit_log (quote_id, quote_type, change_type, diff, pdf_version)
       VALUES ($1, 'ut', 'edit', $2, $3)`,
      [req.params.id, JSON.stringify(diff), existing.pdf_version],
    );

    return res.json(updated);
  } catch (e) {
    console.error('PUT /:id error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── POST /quote/:id/pdf ───────────────────────────────────────
router.post('/:id/pdf', requirePermission('UT_QUOTE_CREATE'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid quote ID format', code: 'VALIDATION_ERROR' });
  }
  try {
    const row = await queryOne<{ id: string; quote_number: string; customer_name: string; response_body: Record<string, unknown>; pdf_version: number }>(
      'SELECT id, quote_number, customer_name, response_body, pdf_version FROM ut.incoming_quotes WHERE id = $1',
      [req.params.id],
    );
    if (!row) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    const newVersion = (row.pdf_version ?? 0) + 1;
    const body = row.response_body as { items?: Array<Record<string, unknown>>; summary?: Record<string, unknown> };

    // Use the branded UT quote PDF template
    const pdfData: UtQuotePdfData = {
      quoteNumber:  row.quote_number,
      generatedAt:  new Date().toISOString(),
      customerName: row.customer_name,
      standard:     (row as Record<string, unknown>).standard as string | undefined,
      rushLevel:    ((row as Record<string, unknown>).rush_level as string ?? 'normal') as 'normal' | 'expedited',
      requestedBy:  undefined,
      items:        (body.items ?? []) as UtQuotePdfData['items'],
      summary: {
        totalGrand:    ((body.summary as Record<string, unknown>)?.totalGrand as number) ?? 0,
        totalParts:    ((body.summary as Record<string, unknown>)?.totalParts as number) ?? 0,
        totalTechFees: ((body.summary as Record<string, unknown>)?.totalTechFees as number) ?? 0,
        totalEnvFees:  ((body.summary as Record<string, unknown>)?.totalEnvFees as number) ?? 0,
        rushSurcharge: ((body.summary as Record<string, unknown>)?.rushSurcharge as number) ?? 0,
        rushMultiplier:((body.summary as Record<string, unknown>)?.rushMultiplier as number) ?? 1,
        deliveryFee:   ((body.summary as Record<string, unknown>)?.deliveryFee as string) ?? '',
        leadTime:      ((body.summary as Record<string, unknown>)?.leadTime as string) ?? '',
      },
      pdfVersion: newVersion,
    };
    const html = buildUtQuoteHtml(pdfData);

    const pdfBuf = await generatePdf(html);
    const filePath = await storePdf('ut', row.id, newVersion, pdfBuf);

    await queryOne(
      'UPDATE ut.incoming_quotes SET pdf_version = $1, pdf_path = $2 WHERE id = $3',
      [newVersion, filePath, row.id],
    );
    await queryOne(
      `INSERT INTO app.quote_audit_log (quote_id, quote_type, change_type, pdf_version)
       VALUES ($1, 'ut', 'pdf_generated', $2)`,
      [row.id, newVersion],
    );

    return res.json({ pdf_version: newVersion, pdf_path: filePath });
  } catch (e) {
    console.error('POST /:id/pdf error', e);
    return res.status(500).json({ error: 'PDF generation failed', code: 'PDF_ERROR', detail: String(e) });
  }
});

// ── GET /quote/:id/pdf ────────────────────────────────────────
router.get('/:id/pdf', requirePermission('UT_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid quote ID format', code: 'VALIDATION_ERROR' });
  }
  try {
    const row = await queryOne<{ pdf_path: string | null; quote_number: string }>(
      'SELECT pdf_path, quote_number FROM ut.incoming_quotes WHERE id = $1',
      [req.params.id],
    );
    if (!row) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
    if (!row.pdf_path) return res.status(404).json({ error: 'PDF not generated yet', code: 'NOT_FOUND' });

    const buf = await fs.readFile(row.pdf_path);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${row.quote_number}.pdf"`);
    return res.send(buf);
  } catch (e) {
    console.error('GET /:id/pdf error', e);
    return res.status(500).json({ error: 'Failed to read PDF', code: 'INTERNAL_ERROR' });
  }
});

// ── PATCH /quote/:id/status ───────────────────────────────────
/**
 * Advance a quote through its lifecycle:
 *   calculated → pending → sent → accepted | rejected
 *
 * Body: { "status": "sent" }
 *
 * Used by:
 *   - Portal UI (future quote management screen)
 *   - n8n workflow after emailing the quote PDF
 *   - Salesforce writeback after quoteNumber is confirmed
 */
const VALID_STATUSES = ['calculated', 'pending', 'sent', 'accepted', 'rejected'] as const;
type QuoteStatus = typeof VALID_STATUSES[number];

router.patch('/:id/status', requirePermission('UT_QUOTE_CREATE'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid quote ID format', code: 'VALIDATION_ERROR' });
  }
  const { status } = req.body as { status: QuoteStatus };
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }
  try {
    const row = await queryOne<{ id: string; quote_number: string; status: string }>(
      `UPDATE ut.incoming_quotes SET status = $1 WHERE id = $2
       RETURNING id, quote_number, status`,
      [status, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
    return res.json({ id: row.id, quoteNumber: row.quote_number, status: row.status });
  } catch (e) {
    console.error('PATCH /:id/status error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
