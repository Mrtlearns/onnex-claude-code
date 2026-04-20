import crypto from 'node:crypto';
import { pool } from '../db';
import {
  validateClassification,
  validateAnalysis,
} from './rt-validators';
import {
  getStage1SystemPrompt,
  assembleStage2SystemPrompt,
  buildStage1UserPrompt,
  buildStage2UserPrompt,
  type DrawingData,
} from './prompt-assembler';
import { fetchSpecForModule } from './spec-fetcher';

const COMPLY_URL    = process.env.COMPLY_URL    ?? 'http://comply:8010';
const SANITIZE_URL  = process.env.SANITIZE_URL  ?? 'http://sanitize:8011';
const GATEWAY_URL   = process.env.GATEWAY_URL   ?? 'http://gateway:8012';

// Max retries for Stage 2 before falling back to Opus
const STAGE2_MAX_RETRIES = 2;

// ── Status helpers ────────────────────────────────────────────────────────────

async function updateJob(jobId: string, fields: Record<string, unknown>): Promise<void> {
  const keys   = Object.keys(fields);
  const values = Object.values(fields);
  const sets   = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await pool.query(
    `UPDATE rt.analysis_jobs SET ${sets}, updated_at = now() WHERE id = $1`,
    [jobId, ...values],
  );
}

// ── Step 1: Comply ────────────────────────────────────────────────────────────
// Matches ClassifyRequest / ClassifyResponse in pipeline/shared/models.py

interface ComplyResult {
  classification:       string;   // CLEAN | EAR_LOW | EAR_HIGH | ITAR | NEEDS_REVIEW | REJECTED
  llm_routing:          string;   // CLOUD_OK | LOCAL_ONLY | HOLD
  risk_score:           number;
  drawing_number?:      string;
  extracted_text?:      string;   // OCR or PDF text for LLM context
  rendered_image_b64?:  string;   // PII-scrubbed image for LLM vision
  rendered_media_type?: string;   // e.g. "image/png"
}

async function runComply(
  fileBase64: string,
  fileName:   string,
  intakeId:   string,
): Promise<ComplyResult> {
  const resp = await fetch(`${COMPLY_URL}/classify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    // Field name is content_b64 per ClassifyRequest model
    body: JSON.stringify({ content_b64: fileBase64, filename: fileName, intake_id: intakeId }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Comply service error ${resp.status}: ${body}`);
  }
  return resp.json() as Promise<ComplyResult>;
}

// ── Step 2: Sanitize ──────────────────────────────────────────────────────────
// Matches SanitizeRequest / SanitizeResponse in pipeline/shared/models.py

interface SanitizeResult {
  sanitized_text: string;
  job_id:         string;
  entity_count:   number;
}

async function runSanitize(
  text:         string,
  intakeId:     string,
  llmRouting:   string,
): Promise<SanitizeResult> {
  const resp = await fetch(`${SANITIZE_URL}/sanitize`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    // Field name is `routing` per SanitizeRequest model (not llm_routing)
    body: JSON.stringify({ intake_id: intakeId, text, routing: llmRouting }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Sanitize service error ${resp.status}: ${body}`);
  }
  return resp.json() as Promise<SanitizeResult>;
}

// ── Gateway call ──────────────────────────────────────────────────────────────
// Matches AnalyzeRequest / AnalyzeResponse in pipeline/shared/models.py

interface GatewayRequest {
  intake_id:       string;
  sanitize_job_id: string;
  classification:  string;   // comply classification value: CLEAN | EAR_LOW | etc.
  llm_routing:     string;
  prompt:          string;
  system_prompt?:  string;
  model?:          string;   // step-level model override (e.g. for retry with Opus)
  images?:         Array<{ media_type: string; data_b64: string }>;
  max_tokens?:     number;   // override provider default — Stage 2 needs >4096 to avoid truncation
}

interface GatewayResponse {
  request_id:    string;
  provider_used: string;
  model_used:    string;
  response_json: unknown;    // already-parsed JSON dict from the LLM
  prompt_tokens: number | null;
  latency_ms:    number;
}

async function callGateway(req: GatewayRequest): Promise<GatewayResponse> {
  const resp = await fetch(`${GATEWAY_URL}/analyze`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gateway error ${resp.status}: ${body}`);
  }
  return resp.json() as Promise<GatewayResponse>;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runRTPipeline(
  jobId:      string,
  fileBase64: string,
  fileName:   string,
): Promise<void> {
  const intakeId  = jobId;
  const fileHash  = crypto.createHash('sha256').update(fileBase64).digest('hex').slice(0, 16);

  try {
    // ── 1. Comply ─────────────────────────────────────────────────────────────
    await updateJob(jobId, { status: 'classifying', stage: 'ITAR classification', file_hash: fileHash });

    let complyResult: ComplyResult;
    try {
      complyResult = await runComply(fileBase64, fileName, intakeId);
    } catch (e) {
      // If comply is down (dev mode), default to CLOUD_OK with warning
      console.warn('[rt-pipeline] comply unavailable, defaulting to CLOUD_OK:', e);
      complyResult = { classification: 'CLEAN', llm_routing: 'CLOUD_OK', risk_score: 0 };
    }

    if (complyResult.llm_routing === 'HOLD') {
      await updateJob(jobId, {
        status:        'failed',
        comply_result: JSON.stringify(complyResult),
        error:         'Document placed on HOLD by ITAR compliance check — manual review required',
      });
      return;
    }

    if (complyResult.llm_routing === 'LOCAL_ONLY') {
      await updateJob(jobId, {
        status:        'failed',
        comply_result: JSON.stringify(complyResult),
        error:         `ITAR-classified document (score ${complyResult.risk_score}). Local LLM required — Ollama not available. Contact your administrator to enable the local processing node.`,
      });
      return;
    }

    await updateJob(jobId, {
      comply_result: JSON.stringify(complyResult),
      llm_routing:   complyResult.llm_routing,
    });

    // ── 2. Extract text — prefer comply OCR output, fall back to filename stub ─
    const rawText = complyResult.extracted_text
      ?? `[Drawing: ${complyResult.drawing_number ?? fileName}]`;

    // ── 3. Sanitize ───────────────────────────────────────────────────────────
    let sanitizeResult: SanitizeResult;
    try {
      sanitizeResult = await runSanitize(rawText, intakeId, complyResult.llm_routing);
    } catch (e) {
      console.warn('[rt-pipeline] sanitize unavailable, using raw text:', e);
      sanitizeResult = { sanitized_text: rawText, job_id: jobId, entity_count: 0 };
    }

    await updateJob(jobId, { sanitize_job_id: sanitizeResult.job_id });

    const drawingData: DrawingData = {
      rawText:       sanitizeResult.sanitized_text,
      drawingNumber: complyResult.drawing_number ?? fileName.replace(/\.[^.]+$/, ''),
    };

    // Build image payload from comply-rendered drawing (PII-scrubbed)
    const drawingImages: Array<{ media_type: string; data_b64: string }> | undefined =
      complyResult.rendered_image_b64 && complyResult.rendered_media_type
        ? [{ media_type: complyResult.rendered_media_type, data_b64: complyResult.rendered_image_b64 }]
        : undefined;

    if (drawingImages) {
      console.log('[rt-pipeline] drawing image available for LLM vision, media_type:', complyResult.rendered_media_type);
    } else {
      console.warn('[rt-pipeline] no rendered image from comply — LLM will use text only');
    }

    // ── 4. Stage 1: Classify ─────────────────────────────────────────────────
    await updateJob(jobId, { stage: 'Part classification (Stage 1)' });

    const stage1System = await getStage1SystemPrompt();
    const stage1User   = buildStage1UserPrompt(drawingData);

    const stage1Response = await callGateway({
      intake_id:       intakeId,
      sanitize_job_id: sanitizeResult.job_id,
      classification:  complyResult.classification,   // comply ITAR classification
      llm_routing:     complyResult.llm_routing,
      system_prompt:   stage1System,
      prompt:          stage1User,
      images:          drawingImages,
    });

    // response_json is already a parsed dict — no need to JSON.parse
    const classValidation = validateClassification(stage1Response.response_json);

    if (!classValidation.success) {
      throw new Error(
        `Stage 1 validation failed: ${classValidation.errors.join('; ')}`,
      );
    }

    const classification = classValidation.data!;
    const lowConfidence  = classification.confidence < 0.6;

    if (classValidation.warnings.length > 0) {
      console.warn('[rt-pipeline] Stage 1 warnings:', classValidation.warnings);
    }

    await updateJob(jobId, {
      classification:  JSON.stringify(classification),
      low_confidence:  lowConfidence,
      stage:           'Assembling analysis prompt',
      status:          'assembling',
    });

    // ── 5. Prompt Assembly ───────────────────────────────────────────────────
    // Optionally inject live spec clauses from Nextcloud _llm_md/ files.
    // fetchSpecForModule returns null gracefully if no spec is configured or
    // the file hasn't been converted yet — pipeline continues without it.
    const specContent  = await fetchSpecForModule(classification.analysis_module);
    const stage2System = await assembleStage2SystemPrompt(classification.analysis_module, specContent);
    const stage2User   = buildStage2UserPrompt(classification);

    // ── 6. Stage 2: RT Analysis ──────────────────────────────────────────────
    await updateJob(jobId, { stage: 'RT analysis (Stage 2)', status: 'analyzing' });

    let analysisValidation;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= STAGE2_MAX_RETRIES; attempt++) {
      try {
        const stage2Response = await callGateway({
          intake_id:       intakeId,
          sanitize_job_id: sanitizeResult.job_id,
          classification:  complyResult.classification,
          llm_routing:     complyResult.llm_routing,
          system_prompt:   stage2System,
          prompt:          stage2User,
          // Stage 2 works from structured Stage 1 output — no image needed
          // (sending the full PNG caused 240s+ timeouts via claude_cli)
          images:          undefined,
          // Use OpenRouter model ID format. Sonnet for Stage 2 structured JSON output.
          // Haiku is the DB default (Stage 1); Sonnet for Stage 2 larger response.
          model: 'anthropic/claude-sonnet-4-6',
          // Stage 2 structured output (render_model + zones + intersections + shot_plan)
          // routinely exceeds the provider default (4096). Without this, output is
          // truncated mid-JSON and validation fails on every required field.
          max_tokens: 16384,
        });

        // response_json is already parsed — validate directly
        analysisValidation = validateAnalysis(stage2Response.response_json, classification);

        if (analysisValidation.success) break;

        lastError = new Error(
          `Stage 2 validation failed (attempt ${attempt}): ${analysisValidation.errors.join('; ')}`,
        );
        console.warn('[rt-pipeline]', lastError.message);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(`[rt-pipeline] Stage 2 attempt ${attempt} failed:`, lastError.message);
      }
    }

    if (!analysisValidation?.success || !analysisValidation.data) {
      throw lastError ?? new Error('Stage 2 analysis failed after all retries');
    }

    if (analysisValidation.warnings.length > 0) {
      console.warn('[rt-pipeline] Stage 2 warnings:', analysisValidation.warnings);
    }

    // ── 7. Complete ──────────────────────────────────────────────────────────
    await updateJob(jobId, {
      status:   'complete',
      stage:    'Complete',
      analysis: JSON.stringify(analysisValidation.data),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[rt-pipeline] fatal error:', message);
    await updateJob(jobId, { status: 'failed', error: message });
  }
}
