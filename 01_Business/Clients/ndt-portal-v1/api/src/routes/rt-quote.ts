import fs from 'node:fs/promises';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/requirePermission';
import { generatePdf, storePdf, buildHtmlDocument, fmtMoney } from '../lib/pdfGenerator';
import { query, queryOne } from '../db';
import {
  computeRates, computeFilmSize, computeViewRow, sumViewCalcs, computeGrandTotal,
  SHOT_TYPE_LABELS,
  type DbRtSettings, type DbRtOperator, type DbRtFilmSize, type DbRtPricingTier,
} from '../calculations/rt';
import type {
  RtQuoteRequest, RtQuoteResponse, RtViewResult, RtTierResult, RtQuoteTotals,
} from '../types/rt-quote';

const router = Router();

// ── Zod validation ────────────────────────────────────────────
const ViewSchema = z.object({
  viewNumber:      z.number().int().positive().optional(),
  shotType:        z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  qtyPartsPerFilm: z.number().int().positive(),
  filmSizeLabel:   z.string().optional(),
  filmSizeId:      z.string().uuid().optional(),
  unpackLoadTime:  z.number().nonnegative(),
  darkroomSortTime:z.number().nonnegative(),
  shotTime:        z.number().nonnegative(),
  readTime:        z.number().nonnegative(),
}).refine(d => d.filmSizeId || d.filmSizeLabel, {
  message: 'Either filmSizeId or filmSizeLabel is required per view',
});

const QuoteSchema = z.object({
  partNumber:    z.string().min(1),
  customerName:  z.string().min(1),
  pricingTierId: z.string().uuid().optional(),
  views:         z.array(ViewSchema).min(1).max(50),
  source:        z.enum(['api','salesforce','email','portal']).optional().default('api'),
  externalRef:   z.string().optional(),
  requestedBy:   z.string().optional(),
  notes:         z.string().optional(),
});

// ── POST /rt-quote ────────────────────────────────────────────
router.post('/', requirePermission('RT_QUOTE_CREATE'), async (req: Request, res: Response) => {
  // 1. Validate
  const parsed = QuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data as RtQuoteRequest;

  // 2. Load settings + operators + film_sizes + tiers from DB in parallel
  const [settingsRows, operators, filmSizesRaw, tiersRaw] = await Promise.all([
    query<DbRtSettings>('SELECT * FROM rt.settings LIMIT 1'),
    query<DbRtOperator>('SELECT * FROM rt.operators ORDER BY sort_order'),
    query<DbRtFilmSize>('SELECT * FROM rt.film_sizes ORDER BY sort_order'),
    query<DbRtPricingTier>('SELECT * FROM rt.pricing_tiers ORDER BY sort_order'),
  ]);

  const settings = settingsRows[0];
  if (!settings) {
    return res.status(500).json({ error: 'RT settings not found', code: 'MISSING_SETTINGS' });
  }
  const activeOperators = operators.filter(o => o.is_active);
  if (activeOperators.length === 0) {
    return res.status(500).json({ error: 'No active operators found', code: 'NO_ACTIVE_OPERATORS' });
  }

  // 3. Build film size map (label → computed)
  const filmByLabel = new Map<string, ReturnType<typeof computeFilmSize>>();
  const filmById    = new Map<string, ReturnType<typeof computeFilmSize>>();
  for (const fs of filmSizesRaw) {
    const computed = computeFilmSize(fs, settings.film_markup_pct);
    filmByLabel.set(fs.label.toUpperCase(), computed);
    filmById.set(fs.id, computed);
  }

  // 4. Compute crew rates
  const rates = computeRates(settings, activeOperators);

  // 5. Validate film sizes for all views
  for (let i = 0; i < input.views.length; i++) {
    const v = input.views[i];
    const film = v.filmSizeId
      ? filmById.get(v.filmSizeId)
      : filmByLabel.get((v.filmSizeLabel ?? '').toUpperCase());
    if (!film) {
      return res.status(404).json({
        error: `View ${i + 1}: film size not found: ${v.filmSizeId ?? v.filmSizeLabel}`,
        code: 'FILM_SIZE_NOT_FOUND',
      });
    }
  }

  // 6. Validate pricing tier if specified
  let selectedTierOverride: DbRtPricingTier | null = null;
  if (input.pricingTierId) {
    selectedTierOverride = tiersRaw.find(t => t.id === input.pricingTierId) ?? null;
    if (!selectedTierOverride) {
      return res.status(404).json({
        error: `Pricing tier not found: ${input.pricingTierId}`,
        code: 'PRICING_TIER_NOT_FOUND',
      });
    }
  }

  // 7. Calculate using FIRST tier to build view results (with cost structure)
  //    We always show full breakdown using the cheapest or selected tier
  const referenceCalcTier = selectedTierOverride ?? tiersRaw[0];

  const viewResults: RtViewResult[] = input.views.map((v, i) => {
    const film = v.filmSizeId
      ? filmById.get(v.filmSizeId)!
      : filmByLabel.get((v.filmSizeLabel ?? '').toUpperCase())!;

    const calc = computeViewRow(
      v.shotType, v.qtyPartsPerFilm,
      v.unpackLoadTime, v.darkroomSortTime, v.shotTime, v.readTime,
      rates, film, referenceCalcTier,
    );

    return {
      viewNumber:     v.viewNumber ?? (i + 1),
      shotType:       v.shotType,
      shotTypeLabel:  SHOT_TYPE_LABELS[v.shotType],
      qtyPartsPerFilm: v.qtyPartsPerFilm,
      filmSize: {
        label:               film.label,
        widthIn:             film.width,
        heightIn:            film.height,
        sqInches:            parseFloat(film.sq_inches.toFixed(3)),
        costPerSheet:        parseFloat(film.cost_per_sheet.toFixed(4)),
        costPerSheetMarked:  parseFloat(film.cost_per_sheet_marked.toFixed(4)),
      },
      costs: {
        shooterCost:     calc.shooterCost,
        darkroomCost:    calc.darkroomCost,
        readerCost:      calc.readerCost,
        laborCost:       calc.laborCost,
        filmCostPerPart: calc.filmCostPerPart,
        pricePerView:    calc.pricePerView,
      },
    };
  });

  // 8. Compute tier comparison (all 10 tiers)
  const tierComparison: RtTierResult[] = tiersRaw.map(tier => {
    const calcs = input.views.map((v) => {
      const film = v.filmSizeId
        ? filmById.get(v.filmSizeId)!
        : filmByLabel.get((v.filmSizeLabel ?? '').toUpperCase())!;
      return computeViewRow(
        v.shotType, v.qtyPartsPerFilm,
        v.unpackLoadTime, v.darkroomSortTime, v.shotTime, v.readTime,
        rates, film, tier,
      );
    });
    const totals = sumViewCalcs(calcs);
    const filmTotal  = parseFloat(totals.totalFilm.toFixed(2));
    const grandTotal = parseFloat(computeGrandTotal(totals, settings).toFixed(2));
    return {
      tierId:          tier.id,
      tierLabel:       tier.label,
      singleShotRate:  tier.single_shot_rate,
      multiShotRate:   tier.multi_shot_rate,
      filmTotal,
      grandTotal,
      isRecommended:   false,  // set below
    };
  });

  // Mark recommended (lowest grandTotal)
  const minGrand = Math.min(...tierComparison.map(t => t.grandTotal));
  for (const t of tierComparison) {
    if (t.grandTotal === minGrand) { t.isRecommended = true; break; }
  }

  // 9. Build totals from selected / cheapest tier
  const selectedTierResult = selectedTierOverride
    ? tierComparison.find(t => t.tierId === selectedTierOverride!.id)!
    : tierComparison.find(t => t.isRecommended)!;

  // Recompute totals using selected tier for accuracy
  const selectedCalcs = input.views.map(v => {
    const film = v.filmSizeId
      ? filmById.get(v.filmSizeId)!
      : filmByLabel.get((v.filmSizeLabel ?? '').toUpperCase())!;
    const tier = tiersRaw.find(t => t.id === selectedTierResult.tierId)!;
    return computeViewRow(
      v.shotType, v.qtyPartsPerFilm,
      v.unpackLoadTime, v.darkroomSortTime, v.shotTime, v.readTime,
      rates, film, tier,
    );
  });
  const rawTotals = sumViewCalcs(selectedCalcs);
  const totals: RtQuoteTotals = {
    totalLabor: parseFloat(rawTotals.totalLabor.toFixed(2)),
    totalFilm:  parseFloat(rawTotals.totalFilm.toFixed(2)),
    totalPrice: parseFloat(rawTotals.totalPrice.toFixed(2)),
  };

  // 10. Persist
  const saved = await queryOne<{ id: string; quote_number: string }>(
    `INSERT INTO rt.incoming_quotes
       (source, external_ref, requested_by, part_number, customer_name, notes,
        status, request_body, response_body, grand_total)
     VALUES ($1,$2,$3,$4,$5,$6,'calculated',$7,$8,$9)
     RETURNING id, quote_number`,
    [
      input.source ?? 'api',
      input.externalRef ?? null,
      input.requestedBy ?? null,
      input.partNumber,
      input.customerName,
      input.notes ?? null,
      JSON.stringify(input),
      JSON.stringify({ rates, views: viewResults, totals, tierComparison }),
      selectedTierResult.grandTotal,
    ],
  );

  const response: RtQuoteResponse = {
    quoteId:      saved!.id,
    quoteNumber:  saved!.quote_number,
    generatedAt:  new Date().toISOString(),
    partNumber:   input.partNumber,
    customerName: input.customerName,
    rates,
    views:        viewResults,
    totals,
    tierComparison,
    selectedTier: selectedTierResult,
    source:       (input.source ?? 'api') as RtQuoteResponse['source'],
    externalRef:  input.externalRef,
    requestedBy:  input.requestedBy,
    notes:        input.notes,
  };

  return res.status(201).json(response);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── PUT /rt-quote/:id ─────────────────────────────────────────
router.put('/:id', requirePermission('RT_QUOTE_EDIT'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format', code: 'VALIDATION_ERROR' });
  }
  const { customerName, notes, status } = req.body as { customerName?: string; notes?: string; status?: string };
  const allowed = ['calculated','pending','sent','accepted','rejected'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status', code: 'VALIDATION_ERROR' });
  }
  try {
    const existing = await queryOne<{ customer_name: string; notes: string | null; status: string; pdf_version: number }>(
      'SELECT customer_name, notes, status, pdf_version FROM rt.incoming_quotes WHERE id = $1',
      [req.params.id],
    );
    if (!existing) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    if (customerName !== undefined && customerName !== existing.customer_name) diff.customerName = { from: existing.customer_name, to: customerName };
    if (notes !== undefined && notes !== existing.notes) diff.notes = { from: existing.notes, to: notes };
    if (status !== undefined && status !== existing.status) diff.status = { from: existing.status, to: status };

    const updated = await queryOne<{ id: string; quote_number: string; status: string; pdf_version: number }>(
      `UPDATE rt.incoming_quotes
       SET customer_name = COALESCE($1, customer_name),
           notes         = COALESCE($2, notes),
           status        = COALESCE($3, status)
       WHERE id = $4
       RETURNING id, quote_number, status, pdf_version`,
      [customerName ?? null, notes ?? null, status ?? null, req.params.id],
    );

    await queryOne(
      `INSERT INTO app.quote_audit_log (quote_id, quote_type, change_type, diff, pdf_version)
       VALUES ($1, 'rt', 'edit', $2, $3)`,
      [req.params.id, JSON.stringify(diff), existing.pdf_version],
    );

    return res.json(updated);
  } catch (e) {
    console.error('PUT /rt/:id error', e);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ── POST /rt-quote/:id/pdf ────────────────────────────────────
router.post('/:id/pdf', requirePermission('RT_QUOTE_EDIT'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format', code: 'VALIDATION_ERROR' });
  }
  try {
    const row = await queryOne<{ id: string; quote_number: string; part_number: string; customer_name: string; response_body: Record<string, unknown>; pdf_version: number }>(
      'SELECT id, quote_number, part_number, customer_name, response_body, pdf_version FROM rt.incoming_quotes WHERE id = $1',
      [req.params.id],
    );
    if (!row) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });

    const newVersion = (row.pdf_version ?? 0) + 1;
    const body = row.response_body as { totals?: { totalPrice?: number; totalLabor?: number; totalFilm?: number }; views?: unknown[] };
    const totals = body.totals;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const html = buildHtmlDocument(
      `RT Quote — ${row.quote_number}`,
      `<h1>NDT Portal — RT Quote</h1>
       <div class="meta">Quote #: ${row.quote_number} &nbsp;|&nbsp; Part: ${row.part_number} &nbsp;|&nbsp; Customer: ${row.customer_name} &nbsp;|&nbsp; Generated: ${date}</div>
       ${totals ? `
       <h2>Summary</h2>
       <div class="row"><span class="label">Grand Total</span><span>${fmtMoney(totals.totalPrice ?? 0)}</span></div>
       <div class="row"><span class="label">Total Labor</span><span>${fmtMoney(totals.totalLabor ?? 0)}</span></div>
       <div class="row"><span class="label">Total Film</span><span>${fmtMoney(totals.totalFilm ?? 0)}</span></div>
       <div class="row"><span class="label">Views</span><span>${(body.views as unknown[])?.length ?? 0}</span></div>
       ` : ''}
       <div class="footer">NDT Portal · Onnex AI · PDF v${newVersion}</div>`,
    );

    const pdfBuf = await generatePdf(html);
    const filePath = await storePdf('rt', row.id, newVersion, pdfBuf);

    await queryOne(
      'UPDATE rt.incoming_quotes SET pdf_version = $1, pdf_path = $2 WHERE id = $3',
      [newVersion, filePath, row.id],
    );
    await queryOne(
      `INSERT INTO app.quote_audit_log (quote_id, quote_type, change_type, pdf_version)
       VALUES ($1, 'rt', 'pdf_generated', $2)`,
      [row.id, newVersion],
    );

    return res.json({ pdf_version: newVersion, pdf_path: filePath });
  } catch (e) {
    console.error('POST /rt/:id/pdf error', e);
    return res.status(500).json({ error: 'PDF generation failed', code: 'PDF_ERROR', detail: String(e) });
  }
});

// ── GET /rt-quote/:id/pdf ─────────────────────────────────────
router.get('/:id/pdf', requirePermission('RT_VIEW'), async (req: Request, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format', code: 'VALIDATION_ERROR' });
  }
  try {
    const row = await queryOne<{ pdf_path: string | null; quote_number: string }>(
      'SELECT pdf_path, quote_number FROM rt.incoming_quotes WHERE id = $1',
      [req.params.id],
    );
    if (!row) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
    if (!row.pdf_path) return res.status(404).json({ error: 'PDF not generated yet', code: 'NOT_FOUND' });

    const buf = await fs.readFile(row.pdf_path);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${row.quote_number}.pdf"`);
    return res.send(buf);
  } catch (e) {
    console.error('GET /rt/:id/pdf error', e);
    return res.status(500).json({ error: 'Failed to read PDF', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /rt-quote/:id ─────────────────────────────────────────
router.get('/:id', requirePermission('RT_VIEW'), async (req: Request, res: Response) => {
  if (req.params.id === 'health') {
    return res.json({ status: 'ok', service: 'ndt-rt-api', time: new Date().toISOString() });
  }
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  const row = await queryOne(
    `SELECT id, quote_number, source, part_number, customer_name, notes, status,
            response_body, grand_total, created_at, pdf_version, pdf_path
     FROM rt.incoming_quotes WHERE id = $1`,
    [req.params.id],
  );
  if (!row) return res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
  return res.json(row);
});

// ── GET /rt-quote (list recent) ───────────────────────────────
router.get('/', requirePermission('RT_VIEW'), async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT id, quote_number, part_number, customer_name, source, grand_total, status, created_at
     FROM rt.incoming_quotes ORDER BY created_at DESC LIMIT 50`,
  );
  return res.json(rows);
});

export default router;
