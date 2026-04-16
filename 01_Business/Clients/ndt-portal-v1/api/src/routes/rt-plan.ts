/**
 * RT Planning API — machine-fit + radiographic technique card generation.
 *
 * Mounted at: /rt  (sub-paths: /plan, /machines)
 *
 * POST /rt/plan                  — two-stage LLM planning
 * GET  /rt/machines              — list active machine catalog
 * POST /rt/machines              — add machine
 * PUT  /rt/machines/:machineId   — update machine
 * DELETE /rt/machines/:machineId — soft-delete machine
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import type { RtPlanRequest, RtPlanningResult, PartGeometry } from '../types/rt-plan';
import { requirePermission } from '../middleware/requirePermission';

// ── LLM config helper (identical to sf-analysis.ts) ──────────────────────────
interface LlmConfig { provider: string; apiKey: string; model: string }

async function getLlmConfig(pool: Pool): Promise<LlmConfig | null> {
  const r = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM ut.app_settings
     WHERE key IN ('llm_provider','llm_model','llm_api_key',
                   'openrouter_api_key','anthropic_api_key','openai_api_key')`,
  );
  const m: Record<string, string> = {};
  for (const row of r.rows) m[row.key] = row.value;

  const provider = m['llm_provider'] ?? 'openrouter';
  const apiKey   = m[`${provider}_api_key`] ?? m['llm_api_key'] ?? '';
  const model    = m['llm_model'] ?? (provider === 'openrouter' ? 'openrouter/auto' : 'claude-sonnet-4-6');

  return apiKey ? { provider, apiKey, model } : null;
}

// ── Unified LLM call (identical to sf-analysis.ts) ───────────────────────────
interface ChatMsg { role: 'user' | 'assistant' | 'system'; content: string }

async function llmCall(
  cfg: LlmConfig,
  messages: ChatMsg[],
  systemPrompt: string,
  maxTokens: number,
): Promise<string> {
  if (cfg.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: cfg.apiKey });
    const resp = await client.messages.create(
      {
        model:      cfg.model,
        max_tokens: maxTokens,
        system:     systemPrompt,
        messages:   messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      },
      { timeout: 90_000 },
    );
    return resp.content[0]?.type === 'text' ? resp.content[0].text : '';
  }

  const baseUrl = cfg.provider === 'openai'
    ? 'https://api.openai.com/v1'
    : 'https://openrouter.ai/api/v1';

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:      cfg.model,
      max_tokens: maxTokens,
      messages:   [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`LLM API error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Pool helper ───────────────────────────────────────────────────────────────
function getPool(): Pool {
  return new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });
}

// ── JSON extractor: strip markdown fences if present ─────────────────────────
function extractJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/, '')
    .trim();
}

// ── Stage 1 system prompt ─────────────────────────────────────────────────────
const STAGE1_SYSTEM = `You are an NDT document analyzer. Extract radiographic testing facts from the text.
Return ONLY valid JSON with this exact shape (omit fields you cannot determine):
{
  "partNumber": "string or null",
  "customerName": "string or null",
  "material": "string or null",
  "sectionThicknesses": [{"location": "string", "thicknessMm": number}],
  "penetrationPaths": ["string"],
  "criticalFeatures": ["string"],
  "acceptanceStandard": "string or null",
  "accessConstraints": "string or null"
}
No markdown. No explanation. Only the JSON object.`;

// ── Stage 2 system prompt (injected with machines + extraction) ───────────────
function buildStage2System(machinesCatalog: unknown[], extraction: PartGeometry): string {
  return `You are an RT Level III radiographic testing technician generating inspection technique cards.

AVAILABLE MACHINES:
${JSON.stringify(machinesCatalog, null, 2)}

PART GEOMETRY (extracted):
${JSON.stringify(extraction, null, 2)}

PLANNING RULES:
- kV starting estimate: penetratedThicknessMm × 2.5 for steel; adjust for material density
- Geometric unsharpness: Ug = focal_spot_mm × (ODD / SOD) — minimize unsharpness
- IQI placement: source_side preferred; use film_side only when access prevents source-side
- Flag xray_wash_risk=high when thin-to-thick transitions or significant scatter paths present
- fitScore: 0 if part exceeds machine envelope or weight limit; else score clearance headroom (0–100)
- suitabilityScore: kV range coverage + modality match (0–100)
- Disqualify machines whose envelope or kV range cannot meet the job requirements
- Generate one technique card per required view/location
- For each card, estimate all costing time fields (unpackLoadTime, darkroomSortTime, shotTime, readTime) in minutes

Return ONLY valid JSON matching this exact shape (no markdown, no explanation):
{
  "extraction": { ... },
  "machineSuitability": [{"machineId":"string","fitScore":0,"suitabilityScore":0,"reasoning":"string","disqualified":false,"disqualifyReason":null}],
  "selectedMachineId": "string",
  "selectionRationale": "string",
  "techniqueCards": [
    {
      "viewNumber": 1,
      "location": "string",
      "penetratedThicknessMm": 0,
      "selectedMachineId": "string",
      "kV": 0,
      "mA": null,
      "sod_mm": 0,
      "odd_mm": 0,
      "sfd_mm": 0,
      "geometricUnsharpnessMm": 0,
      "magnificationFactor": 1.0,
      "filmClass": "string",
      "iqi_type": "string",
      "iqi_placement": "source_side",
      "scatter_concern": "low",
      "xray_wash_risk": "low",
      "xray_wash_mitigation": null,
      "filmSizeLabel": "7X17",
      "shotType": 1,
      "qtyPartsPerFilm": 1,
      "shotTime": 5,
      "unpackLoadTime": 5,
      "darkroomSortTime": 3,
      "readTime": 3
    }
  ],
  "imageQualitySummary": "string",
  "planningWarnings": ["string"]
}`;
}

const router = Router();

// ── POST /rt/plan ─────────────────────────────────────────────────────────────
router.post('/plan', requirePermission('RT_PLAN'), async (req: Request, res: Response) => {
  const { rawInput } = req.body as RtPlanRequest;

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    res.status(400).json({ error: 'rawInput is required' });
    return;
  }

  const pool = getPool();
  try {
    // Load LLM config
    const cfg = await getLlmConfig(pool);
    if (!cfg) {
      res.status(400).json({ error: 'No LLM API key configured. Add one in Settings → LLM.' });
      return;
    }

    // Load active machine catalog
    const machineRows = await pool.query(
      `SELECT machine_id, nickname, make_model, spec
       FROM rt.machine_catalog
       WHERE is_active = true
       ORDER BY machine_id`,
    );
    const machines = machineRows.rows.map(r => ({
      machine_id: r.machine_id,
      nickname:   r.nickname,
      make_model: r.make_model,
      spec:       r.spec,
    }));

    // Strip _supplemented_refs before sending to LLM (internal reference data only)
    const machinesForLlm = machines.map(m => {
      const { _supplemented_refs, ...cleanSpec } = (m.spec ?? {}) as Record<string, unknown>;
      return { ...m, spec: cleanSpec };
    });

    // Stage 1 — extract part geometry (max 600 tokens)
    const stage1Raw = await llmCall(
      cfg,
      [{ role: 'user', content: rawInput }],
      STAGE1_SYSTEM,
      600,
    );

    let extraction: PartGeometry;
    try {
      extraction = JSON.parse(extractJson(stage1Raw)) as PartGeometry;
      // Ensure required array fields exist
      extraction.sectionThicknesses = extraction.sectionThicknesses ?? [];
      extraction.penetrationPaths   = extraction.penetrationPaths ?? [];
      extraction.criticalFeatures   = extraction.criticalFeatures ?? [];
    } catch (e) {
      console.error('[rt/plan] Stage 1 JSON parse error:', e, 'raw:', stage1Raw);
      res.status(422).json({ error: 'Stage 1 extraction failed to return valid JSON', raw: stage1Raw });
      return;
    }

    // Stage 2 — machine selection + technique cards (8192 = max Anthropic output)
    const stage2System = buildStage2System(machinesForLlm, extraction);
    const stage2Raw = await llmCall(
      cfg,
      [{ role: 'user', content: 'Generate the RT planning result for the part geometry and machines above.' }],
      stage2System,
      8192,
    );

    let planResult: Omit<RtPlanningResult, 'sessionId'>;
    try {
      planResult = JSON.parse(extractJson(stage2Raw)) as Omit<RtPlanningResult, 'sessionId'>;
    } catch (e) {
      console.error('[rt/plan] Stage 2 JSON parse error:', e, 'raw:', stage2Raw);
      res.status(422).json({ error: 'Stage 2 planning failed to return valid JSON', raw: stage2Raw });
      return;
    }

    // Persist planning session
    const sessionRow = await pool.query(
      `INSERT INTO rt.planning_sessions (raw_input, extraction, plan, selected_machine_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        rawInput,
        JSON.stringify(extraction),
        JSON.stringify(planResult),
        planResult.selectedMachineId ?? null,
      ],
    );

    const result: RtPlanningResult = {
      ...planResult,
      extraction, // always use Stage 1 extraction as authoritative
      sessionId: sessionRow.rows[0].id as string,
    };

    res.json(result);
  } catch (err) {
    console.error('[rt/plan]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ── GET /rt/machines ──────────────────────────────────────────────────────────
router.get('/machines', requirePermission('RT_PLAN'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, machine_id, nickname, make_model, spec, is_active, created_at, updated_at
       FROM rt.machine_catalog
       WHERE is_active = true
       ORDER BY machine_id`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[rt/machines GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ── POST /rt/machines ─────────────────────────────────────────────────────────
router.post('/machines', requirePermission('RT_PLAN'), async (req: Request, res: Response) => {
  const { machine_id, nickname, make_model, spec } = req.body as {
    machine_id: string;
    nickname: string;
    make_model?: string;
    spec?: Record<string, unknown>;
  };

  if (!machine_id?.trim() || !nickname?.trim()) {
    res.status(400).json({ error: 'machine_id and nickname are required' });
    return;
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO rt.machine_catalog (machine_id, nickname, make_model, spec)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [machine_id.trim().toUpperCase(), nickname.trim(), make_model ?? null, JSON.stringify(spec ?? {})],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      res.status(409).json({ error: `Machine ID '${machine_id}' already exists` });
      return;
    }
    console.error('[rt/machines POST]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ── PUT /rt/machines/:machineId ───────────────────────────────────────────────
router.put('/machines/:machineId', requirePermission('RT_PLAN'), async (req: Request, res: Response) => {
  const { machineId } = req.params;
  const { nickname, make_model, spec, new_machine_id } = req.body as {
    nickname?: string;
    make_model?: string;
    spec?: Record<string, unknown>;
    new_machine_id?: string;
  };

  const pool = getPool();
  try {
    const newId = new_machine_id?.trim().toUpperCase() ?? null;

    // If machine_id rename requested, check for conflicts first
    if (newId && newId !== machineId) {
      const conflict = await pool.query(
        `SELECT 1 FROM rt.machine_catalog WHERE machine_id = $1`,
        [newId],
      );
      if ((conflict.rowCount ?? 0) > 0) {
        res.status(409).json({ error: `Machine ID '${newId}' already exists` });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE rt.machine_catalog
       SET machine_id = COALESCE($1, machine_id),
           nickname   = COALESCE($2, nickname),
           make_model = COALESCE($3, make_model),
           spec       = COALESCE($4, spec),
           updated_at = now()
       WHERE machine_id = $5 AND is_active = true
       RETURNING *`,
      [newId, nickname ?? null, make_model ?? null, spec ? JSON.stringify(spec) : null, machineId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: `Machine '${machineId}' not found` });
      return;
    }

    // Cascade machine_id rename into workshop.machines.rt_catalog_id
    if (newId && newId !== machineId) {
      await pool.query(
        `UPDATE workshop.machines SET rt_catalog_id = $1 WHERE rt_catalog_id = $2`,
        [newId, machineId],
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[rt/machines PUT]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ── DELETE /rt/machines/:machineId (soft delete) ──────────────────────────────
router.delete('/machines/:machineId', requirePermission('RT_PLAN'), async (req: Request, res: Response) => {
  const { machineId } = req.params;
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE rt.machine_catalog
       SET is_active = false, updated_at = now()
       WHERE machine_id = $1 AND is_active = true`,
      [machineId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: `Machine '${machineId}' not found` });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('[rt/machines DELETE]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

export default router;
