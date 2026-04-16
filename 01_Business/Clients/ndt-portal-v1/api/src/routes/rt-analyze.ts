import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { runRTPipeline } from '../lib/rt-pipeline';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// Accept larger bodies for base64-encoded drawing files (up to 20 MB)
import express from 'express';
router.use(express.json({ limit: '20mb' }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── POST /rt/analyze ──────────────────────────────────────────────────────────
// Body: { file: "<base64>", fileName: "drawing.pdf", mimeType: "application/pdf", quoteId?: "uuid" }
// Returns: { jobId, status: "pending" }

const AnalyzeSchema = z.object({
  file:     z.string().min(1, 'file (base64) is required'),
  fileName: z.string().min(1, 'fileName is required'),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp'])
              .optional()
              .default('application/pdf'),
  quoteId:  z.string().uuid().optional(),
});

router.post('/', requirePermission('RT_ANALYZE'), async (req: Request, res: Response) => {
  const parsed = AnalyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:   'Validation failed',
      code:    'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { file, fileName, quoteId } = parsed.data;

  // Sanity check file size (base64 of 15MB = ~20MB string)
  if (file.length > 20 * 1024 * 1024) {
    return res.status(413).json({ error: 'File too large (max 15 MB)', code: 'FILE_TOO_LARGE' });
  }

  // Create job record
  const job = await queryOne<{ id: string }>(
    `INSERT INTO rt.analysis_jobs (quote_id, file_name, status, stage)
     VALUES ($1, $2, 'pending', 'Queued')
     RETURNING id`,
    [quoteId ?? null, fileName],
  );

  if (!job) {
    return res.status(500).json({ error: 'Failed to create analysis job', code: 'INTERNAL_ERROR' });
  }

  // Fire pipeline as non-blocking background task
  setImmediate(() => {
    runRTPipeline(job.id, file, fileName).catch(err => {
      console.error('[rt-analyze] unhandled pipeline error for job', job.id, err);
    });
  });

  return res.status(202).json({ jobId: job.id, status: 'pending' });
});

// ── GET /rt/analyze/by-quote/:quoteId ────────────────────────────────────────
// Returns the latest complete analysis job linked to a quote (for quote history 3D recall)

router.get('/by-quote/:quoteId', requirePermission('RT_ANALYZE'), async (req: Request, res: Response) => {
  const { quoteId } = req.params;
  if (!UUID_RE.test(quoteId)) {
    return res.status(400).json({ error: 'Invalid quote ID', code: 'VALIDATION_ERROR' });
  }

  const row = await queryOne<{ id: string }>(
    `SELECT id FROM rt.analysis_jobs
     WHERE quote_id = $1 AND status = 'complete'
     ORDER BY created_at DESC LIMIT 1`,
    [quoteId],
  );

  if (!row) {
    return res.status(404).json({ error: 'No complete analysis for this quote', code: 'NOT_FOUND' });
  }

  return res.json({ jobId: row.id });
});

// ── PATCH /rt/analyze/:jobId/quote ───────────────────────────────────────────
// Links an analysis job to a quote

const LinkQuoteSchema = z.object({ quoteId: z.string().uuid() });

router.patch('/:jobId/quote', requirePermission('RT_ANALYZE'), async (req: Request, res: Response) => {
  const { jobId } = req.params;
  if (!UUID_RE.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID', code: 'VALIDATION_ERROR' });
  }

  const parsed = LinkQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'quoteId (UUID) required', code: 'VALIDATION_ERROR' });
  }

  await query(
    `UPDATE rt.analysis_jobs SET quote_id = $1, updated_at = now() WHERE id = $2`,
    [parsed.data.quoteId, jobId],
  );

  return res.json({ ok: true });
});

// ── GET /rt/analyze/:jobId ────────────────────────────────────────────────────
// Returns job status + data (classification + analysis only when complete)

router.get('/:jobId', requirePermission('RT_ANALYZE'), async (req: Request, res: Response) => {
  const { jobId } = req.params;
  if (!UUID_RE.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID', code: 'VALIDATION_ERROR' });
  }

  const row = await queryOne<{
    id:             string;
    status:         string;
    stage:          string | null;
    file_name:      string | null;
    low_confidence: boolean;
    classification: unknown;
    analysis:       unknown;
    comply_result:  unknown;
    llm_routing:    string | null;
    error:          string | null;
    created_at:     string;
    updated_at:     string;
  }>(
    `SELECT id, status, stage, file_name, low_confidence,
            classification, analysis, comply_result, llm_routing,
            error, created_at, updated_at
     FROM rt.analysis_jobs WHERE id = $1`,
    [jobId],
  );

  if (!row) {
    return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });
  }

  const response: Record<string, unknown> = {
    jobId:         row.id,
    status:        row.status,
    stage:         row.stage,
    fileName:      row.file_name,
    llmRouting:    row.llm_routing,
    lowConfidence: row.low_confidence,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };

  if (row.error) {
    response.error = row.error;
  }

  // Only include classification + analysis when complete
  if (row.status === 'complete') {
    response.classification = row.classification;
    response.analysis       = row.analysis;
  }

  // Include comply result for audit/debug (non-sensitive metadata only)
  if (row.comply_result) {
    const comply = row.comply_result as Record<string, unknown>;
    response.complianceClass   = comply['classification'];
    response.complianceScore   = comply['risk_score'] ?? 0;
    response.complianceRouting = comply['llm_routing'] ?? null;
    response.complianceHits    = Array.isArray(comply['usml_hits']) ? comply['usml_hits'] : [];
  }

  return res.json(response);
});

// ── GET /rt/analyze (list recent) ────────────────────────────────────────────

router.get('/', requirePermission('RT_ANALYZE'), async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT id, status, stage, file_name, low_confidence, llm_routing, error, created_at, updated_at
     FROM rt.analysis_jobs
     ORDER BY created_at DESC
     LIMIT 50`,
  );
  return res.json(rows);
});

export default router;
