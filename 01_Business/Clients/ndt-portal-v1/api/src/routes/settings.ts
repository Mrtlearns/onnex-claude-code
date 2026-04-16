/**
 * LLM provider settings endpoints.
 *
 * Mounted at: /settings
 *
 * GET  /settings/providers            — all 4 providers with config (keys masked)
 * POST /settings/providers/:name      — save provider config { apiKey?, model? }
 * POST /settings/providers/:name/test — test provider connectivity
 *
 * Legacy (kept for backward compat):
 * GET  /settings/llm
 * POST /settings/llm
 * POST /settings/llm/test
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '../middleware/requirePermission';
import { requireUser } from '../middleware/jwt';

const router = Router();

const PROVIDERS = ['openrouter', 'anthropic', 'openai', 'gemini'] as const;
type ProviderName = typeof PROVIDERS[number];

const PROVIDER_DEFAULTS: Record<ProviderName, { label: string; defaultModel: string }> = {
  openrouter: { label: 'OpenRouter',    defaultModel: 'openrouter/auto' },
  anthropic:  { label: 'Anthropic',     defaultModel: 'claude-haiku-4-5-20251001' },
  openai:     { label: 'OpenAI',        defaultModel: 'gpt-4o-mini' },
  gemini:     { label: 'Google Gemini', defaultModel: 'gemini-1.5-flash' },
};

const ENV_FILE_PATH = process.env.ENV_FILE_PATH ?? '/opt/ndt-portal/.env';
const ENV_KEY_MAP: Record<ProviderName, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  anthropic:  'ANTHROPIC_API_KEY',
  openai:     'OPENAI_API_KEY',
  gemini:     'GEMINI_API_KEY',
};

function getPool(): Pool {
  return new Pool({
    host:     process.env.PGHOST,
    port:     Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });
}

/** Write or update a key=value line in the .env file. */
function writeEnvKey(envVar: string, value: string): void {
  try {
    let content = '';
    if (fs.existsSync(ENV_FILE_PATH)) {
      content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    }
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.startsWith(`${envVar}=`));
    const newLine = `${envVar}=${value}`;
    if (idx >= 0) {
      lines[idx] = newLine;
    } else {
      lines.push(newLine);
    }
    fs.writeFileSync(ENV_FILE_PATH, lines.join('\n'), 'utf-8');
  } catch (err) {
    console.warn(`[settings] Could not write ${envVar} to .env:`, err);
  }
}

// ─── GET /settings/providers ────────────────────────────────────────────────
router.get('/providers', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const result = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM ut.app_settings
       WHERE key IN (
         'llm_provider',
         'openrouter_api_key','openrouter_model',
         'anthropic_api_key', 'anthropic_model',
         'openai_api_key',    'openai_model',
         'gemini_api_key',    'gemini_model'
       )`,
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;

    const providers = PROVIDERS.map(name => ({
      name,
      label:        PROVIDER_DEFAULTS[name].label,
      defaultModel: PROVIDER_DEFAULTS[name].defaultModel,
      model:        map[`${name}_model`] ?? PROVIDER_DEFAULTS[name].defaultModel,
      apiKey:       map[`${name}_api_key`] ? '••••••••' : '',
      hasKey:       Boolean(map[`${name}_api_key`]),
    }));

    return res.json({
      providers,
      defaultProvider: map['llm_provider'] ?? 'openrouter',
    });
  } catch (err) {
    console.error('[settings/providers] GET failed:', err);
    return res.status(500).json({ error: 'Failed to read provider settings' });
  } finally {
    await pool.end();
  }
});

// ─── POST /settings/providers/:name ─────────────────────────────────────────
router.post('/providers/:name', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const name = req.params.name as ProviderName;
  if (!PROVIDERS.includes(name)) {
    return res.status(400).json({ error: `Unknown provider: ${name}` });
  }

  const { apiKey, model, setDefault } = req.body ?? {};

  const pool = getPool();
  try {
    const upsert = `
      INSERT INTO ut.app_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    if (model !== undefined && model !== '') {
      await pool.query(upsert, [`${name}_model`, model]);
    }
    if (apiKey !== undefined && apiKey !== '') {
      await pool.query(upsert, [`${name}_api_key`, apiKey]);
      writeEnvKey(ENV_KEY_MAP[name], apiKey);
    }
    if (setDefault === true) {
      await pool.query(upsert, ['llm_provider', name]);
      // Also keep legacy keys in sync
      const modelToUse = model ?? PROVIDER_DEFAULTS[name].defaultModel;
      await pool.query(upsert, ['llm_model', modelToUse]);
      if (apiKey) await pool.query(upsert, ['llm_api_key', apiKey]);
    }

    return res.json({ ok: true, provider: name });
  } catch (err) {
    console.error('[settings/providers] POST failed:', err);
    return res.status(500).json({ error: 'Failed to save provider settings' });
  } finally {
    await pool.end();
  }
});

// ─── Shared test helper ──────────────────────────────────────────────────────
async function testProvider(name: ProviderName, apiKey: string, model: string | undefined, res: Response): Promise<Response> {
  const resolvedModel = model ?? PROVIDER_DEFAULTS[name].defaultModel;
  const t0 = Date.now();

  try {
    let testUrl: string;
    let headers: Record<string, string>;

    switch (name) {
      case 'openrouter':
        testUrl = 'https://openrouter.ai/api/v1/models';
        headers = { Authorization: `Bearer ${apiKey}` };
        break;
      case 'openai':
        testUrl = 'https://api.openai.com/v1/models';
        headers = { Authorization: `Bearer ${apiKey}` };
        break;
      case 'anthropic':
        testUrl = 'https://api.anthropic.com/v1/models';
        headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
        break;
      case 'gemini':
        testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        headers = {};
        break;
    }

    const response = await fetch(testUrl!, {
      headers: { 'Content-Type': 'application/json', ...headers! },
      signal:  AbortSignal.timeout(15_000),
    });
    const latencyMs = Date.now() - t0;

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.json({ ok: false, error: `HTTP ${response.status}${text ? ': ' + text.slice(0, 200) : ''}`, latencyMs });
    }
    return res.json({ ok: true, latencyMs, message: `Connected · ${resolvedModel}` });
  } catch (err) {
    const latencyMs = Date.now() - t0;
    return res.json({ ok: false, error: err instanceof Error ? err.message : String(err), latencyMs });
  }
}

// ─── POST /settings/providers/:name/test ────────────────────────────────────
router.post('/providers/:name/test', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const name = req.params.name as ProviderName;
  if (!PROVIDERS.includes(name)) {
    return res.status(400).json({ ok: false, error: `Unknown provider: ${name}` });
  }

  // Accept apiKey from body, or fall back to DB
  let { apiKey } = req.body ?? {};
  const { model } = req.body ?? {};

  if (!apiKey || apiKey === '••••••••') {
    // Look up from DB
    const pool = getPool();
    try {
      const r = await pool.query<{ value: string }>(
        `SELECT value FROM ut.app_settings WHERE key = $1`,
        [`${name}_api_key`],
      );
      apiKey = r.rows[0]?.value ?? '';
    } finally { await pool.end(); }
  }

  if (!apiKey) {
    return res.json({ ok: false, error: 'No API key configured for this provider' });
  }

  return testProvider(name, apiKey, model, res);
});

// ─── Claude OAuth token management ──────────────────────────────────────────
// Token stored in ut.app_settings (key-value) and mirrored to a host-mounted
// file at /claude-token-store/token.json for non-Docker consumers.

const TOKEN_STORE_PATH = '/claude-token-store/token.json';
const CLAUDE_OAUTH_KEYS = [
  'claude_oauth_token',
  'claude_oauth_token_preview',
  'claude_oauth_saved_at',
  'claude_oauth_verified_at',
  'claude_oauth_verified_status',
  'claude_oauth_expires_approx',
  'claude_oauth_notes',
] as const;

async function readOAuthStore(): Promise<Record<string, string>> {
  const pool = getPool();
  try {
    const result = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM ut.app_settings WHERE key = ANY($1)`,
      [CLAUDE_OAUTH_KEYS as unknown as string[]],
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;
    return map;
  } finally {
    await pool.end();
  }
}

function writeTokenFile(data: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(TOKEN_STORE_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn('[settings/claude-oauth] could not write token file:', err);
  }
}

// GET /settings/claude-oauth — status only, never exposes raw token
router.get('/claude-oauth', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  try {
    const map = await readOAuthStore();
    return res.json({
      stored:         Boolean(map['claude_oauth_token']),
      preview:        map['claude_oauth_token_preview']  ?? '',
      savedAt:        map['claude_oauth_saved_at']       ?? '',
      verifiedAt:     map['claude_oauth_verified_at']    ?? '',
      verifiedStatus: map['claude_oauth_verified_status'] ?? 'unknown',
      expiresApprox:  map['claude_oauth_expires_approx'] ?? '',
      notes:          map['claude_oauth_notes']          ?? '',
    });
  } catch (err) {
    console.error('[settings/claude-oauth] GET failed:', err);
    return res.status(500).json({ error: 'Failed to read token status' });
  }
});

// POST /settings/claude-oauth — save token
router.post('/claude-oauth', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { token, notes } = req.body ?? {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }
  if (!token.startsWith('sk-ant-oat')) {
    return res.status(400).json({ error: 'Invalid token format. Must start with sk-ant-oat' });
  }

  const now           = new Date().toISOString();
  const expiresApprox = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const preview       = token.slice(0, 20) + '...' + token.slice(-6);

  const updates: Record<string, string> = {
    claude_oauth_token:           token,
    claude_oauth_token_preview:   preview,
    claude_oauth_saved_at:        now,
    claude_oauth_verified_at:     '',
    claude_oauth_verified_status: 'pending',
    claude_oauth_expires_approx:  expiresApprox,
    claude_oauth_notes:           notes ?? '',
  };

  const pool = getPool();
  try {
    const upsert = `
      INSERT INTO ut.app_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    for (const [k, v] of Object.entries(updates)) {
      await pool.query(upsert, [k, v]);
    }

    // Mirror to host-mounted file (raw token included for shell scripts)
    writeTokenFile(updates);

    // Apply to current process so gateway can use it immediately
    process.env.CLAUDE_CODE_OAUTH_TOKEN = token;

    return res.json({ ok: true, preview, savedAt: now });
  } catch (err) {
    console.error('[settings/claude-oauth] POST failed:', err);
    return res.status(500).json({ error: 'Failed to save token' });
  } finally {
    await pool.end();
  }
});

// POST /settings/claude-oauth/test — validate token format
// OAuth tokens (sk-ant-oat01-...) are for Claude Code CLI, not the Messages API.
// Validation = format check + store verification timestamp.
router.post('/claude-oauth/test', requirePermission('SETTINGS_LLM'), async (_req: Request, res: Response) => {
  let token: string;
  try {
    const map = await readOAuthStore();
    token = map['claude_oauth_token'] ?? '';
  } catch (_err) {
    return res.status(500).json({ ok: false, error: 'Failed to read token from store' });
  }

  if (!token) {
    return res.json({ ok: false, error: 'No token stored. Save one first.' });
  }

  const t0  = Date.now();
  const now = new Date().toISOString();

  // Format check: must start with sk-ant-oat
  const validFormat = token.startsWith('sk-ant-oat');
  const status      = validFormat ? 'ok' : 'error';
  const latencyMs   = Date.now() - t0;

  const pool = getPool();
  try {
    const upsert = `INSERT INTO ut.app_settings (key, value)
      VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    await pool.query(upsert, ['claude_oauth_verified_at',     now]);
    await pool.query(upsert, ['claude_oauth_verified_status', status]);
  } finally { await pool.end(); }

  if (!validFormat) {
    return res.json({ ok: false, error: 'Token format invalid — expected sk-ant-oat... prefix', latencyMs });
  }

  const preview = `${token.slice(0, 18)}...${token.slice(-6)}`;
  return res.json({
    ok: true,
    latencyMs,
    message: `Token format valid (${preview}). Use claude CLI to verify live access.`,
    verifiedAt: now,
  });
});

// DELETE /settings/claude-oauth — clear token
router.delete('/claude-oauth', requirePermission('SETTINGS_LLM'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const upsert = `INSERT INTO ut.app_settings (key, value)
      VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    const empties: Record<string, string> = {
      claude_oauth_token:           '',
      claude_oauth_token_preview:   '',
      claude_oauth_saved_at:        '',
      claude_oauth_verified_at:     '',
      claude_oauth_verified_status: 'unknown',
      claude_oauth_expires_approx:  '',
      claude_oauth_notes:           '',
    };
    for (const [k, v] of Object.entries(empties)) await pool.query(upsert, [k, v]);

    writeTokenFile(empties);
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;

    return res.json({ ok: true });
  } catch (err) {
    console.error('[settings/claude-oauth] DELETE failed:', err);
    return res.status(500).json({ error: 'Failed to clear token' });
  } finally {
    await pool.end();
  }
});

// ─── LLM auth method toggle ─────────────────────────────────────────────────
// GET  /settings/llm-auth-method   — returns { method: 'oauth_cli'|'api_key' }
// POST /settings/llm-auth-method   — body: { method: 'oauth_cli'|'api_key' }

router.get('/llm-auth-method', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const r = await pool.query<{ value: string }>(
      `SELECT value FROM ut.app_settings WHERE key = 'llm_auth_method'`,
    );
    return res.json({ method: r.rows[0]?.value ?? 'oauth_cli' });
  } catch (err) {
    console.error('[settings/llm-auth-method] GET failed:', err);
    return res.status(500).json({ error: 'Failed to read auth method' });
  } finally {
    await pool.end();
  }
});

router.post('/llm-auth-method', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { method } = req.body ?? {};
  if (method !== 'oauth_cli' && method !== 'api_key') {
    return res.status(400).json({ error: "method must be 'oauth_cli' or 'api_key'" });
  }
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO ut.app_settings (key, value)
       VALUES ('llm_auth_method', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [method],
    );
    return res.json({ ok: true, method });
  } catch (err) {
    console.error('[settings/llm-auth-method] POST failed:', err);
    return res.status(500).json({ error: 'Failed to save auth method' });
  } finally {
    await pool.end();
  }
});

// ─── Chat AI settings ────────────────────────────────────────────────────────
// GET  /settings/chat  — returns { chatProvider, chatModel }
// POST /settings/chat  — body: { chatProvider, chatModel }
// Used exclusively by the admin AI-query (analytics chat assistant).
// Falls back to the pipeline default provider/model if not configured.

router.get('/chat', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const r = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM ut.app_settings WHERE key IN ('chat_provider','chat_model')`,
    );
    const map: Record<string, string> = {};
    for (const row of r.rows) map[row.key] = row.value;
    return res.json({
      chatProvider: map['chat_provider'] ?? '',
      chatModel:    map['chat_model']    ?? '',
    });
  } catch (err) {
    console.error('[settings/chat] GET failed:', err);
    return res.status(500).json({ error: 'Failed to read chat settings' });
  } finally {
    await pool.end();
  }
});

router.post('/chat', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { chatProvider, chatModel } = req.body ?? {};
  if (!chatProvider || !PROVIDERS.includes(chatProvider as ProviderName)) {
    return res.status(400).json({ error: `chatProvider must be one of: ${PROVIDERS.join(', ')}` });
  }
  const pool = getPool();
  try {
    const upsert = `
      INSERT INTO ut.app_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    await pool.query(upsert, ['chat_provider', chatProvider]);
    if (chatModel !== undefined && chatModel !== '') {
      await pool.query(upsert, ['chat_model', chatModel]);
    }
    return res.json({ ok: true, chatProvider, chatModel: chatModel ?? '' });
  } catch (err) {
    console.error('[settings/chat] POST failed:', err);
    return res.status(500).json({ error: 'Failed to save chat settings' });
  } finally {
    await pool.end();
  }
});

// ─── Legacy: GET /settings/llm ──────────────────────────────────────────────
router.get('/llm', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const result = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM ut.app_settings WHERE key IN ('llm_provider','llm_model','llm_api_key')`,
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;
    return res.json({
      provider: map['llm_provider'] ?? 'openrouter',
      model:    map['llm_model']    ?? 'openrouter/auto',
      apiKey:   map['llm_api_key']  ? '••••••••' : '',
    });
  } catch (err) {
    console.error('[settings/llm] GET failed:', err);
    return res.status(500).json({ error: 'Failed to read LLM settings' });
  } finally { await pool.end(); }
});

// ─── Legacy: POST /settings/llm ─────────────────────────────────────────────
router.post('/llm', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { provider, model, apiKey } = req.body ?? {};
  if (!provider || !model) return res.status(400).json({ error: 'provider and model are required' });
  const pool = getPool();
  try {
    const upsert = `INSERT INTO ut.app_settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    await pool.query(upsert, ['llm_provider', provider]);
    await pool.query(upsert, ['llm_model', model]);
    if (apiKey) {
      await pool.query(upsert, ['llm_api_key', apiKey]);
      await pool.query(upsert, [`${provider}_api_key`, apiKey]);
      writeEnvKey(ENV_KEY_MAP[provider as ProviderName] ?? provider.toUpperCase() + '_API_KEY', apiKey);
    }
    return res.json({ ok: true, provider, model });
  } catch (err) {
    console.error('[settings/llm] POST failed:', err);
    return res.status(500).json({ error: 'Failed to save LLM settings' });
  } finally { await pool.end(); }
});

// ─── Legacy: POST /settings/llm/test ────────────────────────────────────────
router.post('/llm/test', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { provider, model, apiKey } = req.body ?? {};
  if (!provider || !apiKey) return res.status(400).json({ ok: false, error: 'provider and apiKey are required' });
  return testProvider(provider as ProviderName, apiKey, model, res);
});

// ─── Folder References ────────────────────────────────────────────────────────
/**
 * GET /settings/folder-references — list active references
 */
router.get('/folder-references', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id,
              alias,
              display_name   AS "displayName",
              nextcloud_path AS "nextcloudPath",
              description,
              is_active      AS "isActive",
              created_at     AS "createdAt",
              updated_at     AS "updatedAt"
       FROM app.folder_references
       WHERE is_active = TRUE
       ORDER BY display_name`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[settings/folder-references GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

/**
 * POST /settings/folder-references — create a new reference
 */
router.post('/folder-references', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { alias, displayName, nextcloudPath, description } = req.body as {
    alias?: string;
    displayName?: string;
    nextcloudPath?: string;
    description?: string;
  };

  if (!alias?.trim() || !displayName?.trim() || !nextcloudPath?.trim()) {
    res.status(400).json({ error: 'alias, displayName, and nextcloudPath are required' });
    return;
  }

  // alias must be lowercase alphanumeric + underscore only
  if (!/^[a-z0-9_]+$/.test(alias.trim())) {
    res.status(400).json({ error: 'alias must contain only lowercase letters, numbers, and underscores' });
    return;
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO app.folder_references (alias, display_name, nextcloud_path, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id,
                 alias,
                 display_name   AS "displayName",
                 nextcloud_path AS "nextcloudPath",
                 description,
                 is_active      AS "isActive",
                 created_at     AS "createdAt",
                 updated_at     AS "updatedAt"`,
      [alias.trim(), displayName.trim(), nextcloudPath.trim(), description ?? null],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      res.status(409).json({ error: `Alias '${alias}' already exists` });
      return;
    }
    console.error('[settings/folder-references POST]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

/**
 * PUT /settings/folder-references/:id — update a reference
 */
router.put('/folder-references/:id', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { alias, displayName, nextcloudPath, description, isActive } = req.body as {
    alias?: string;
    displayName?: string;
    nextcloudPath?: string;
    description?: string;
    isActive?: boolean;
  };

  if (alias !== undefined && !/^[a-z0-9_]+$/.test(alias)) {
    res.status(400).json({ error: 'alias must contain only lowercase letters, numbers, and underscores' });
    return;
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE app.folder_references
       SET alias          = COALESCE($1, alias),
           display_name   = COALESCE($2, display_name),
           nextcloud_path = COALESCE($3, nextcloud_path),
           description    = COALESCE($4, description),
           is_active      = COALESCE($5, is_active),
           updated_at     = NOW()
       WHERE id = $6
       RETURNING id,
                 alias,
                 display_name   AS "displayName",
                 nextcloud_path AS "nextcloudPath",
                 description,
                 is_active      AS "isActive",
                 created_at     AS "createdAt",
                 updated_at     AS "updatedAt"`,
      [
        alias?.trim() ?? null,
        displayName?.trim() ?? null,
        nextcloudPath?.trim() ?? null,
        description ?? null,
        isActive ?? null,
        id,
      ],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Folder reference not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      res.status(409).json({ error: `Alias '${alias}' already exists` });
      return;
    }
    console.error('[settings/folder-references PUT]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

/**
 * DELETE /settings/folder-references/:id — soft-delete
 */
router.delete('/folder-references/:id', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE app.folder_references
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE`,
      [id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Folder reference not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('[settings/folder-references DELETE]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
});

// ─── ITAR Keyword Library ────────────────────────────────────────────────────

const VALID_CATEGORIES = ['ITAR', 'EAR', 'MIL_SPEC', 'USML', 'CAGE'] as const;

function getActingUser(req: Request): { sub: string; email: string } {
  try {
    const user = requireUser(req);
    return { sub: user.sub, email: user.email };
  } catch {
    return { sub: 'system', email: 'system' };
  }
}

// GET /settings/itar-keywords
router.get('/itar-keywords', requirePermission('SETTINGS_VIEW'), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, keyword, category, weight, description
       FROM pipeline.comply_keyword_library
       ORDER BY category, keyword`,
    );
    return res.json({ keywords: result.rows });
  } catch (err) {
    console.error('[settings/itar-keywords] GET failed:', err);
    return res.status(500).json({ error: 'Failed to read keyword library' });
  } finally {
    await pool.end();
  }
});

// POST /settings/itar-keywords
router.post('/itar-keywords', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const { keyword, category, weight, description } = req.body ?? {};

  if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
    return res.status(400).json({ error: 'keyword is required' });
  }
  if (keyword.trim().length > 200) {
    return res.status(400).json({ error: 'keyword must be 200 characters or fewer' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  const weightNum = Number(weight);
  if (!Number.isInteger(weightNum) || weightNum < 1 || weightNum > 50) {
    return res.status(400).json({ error: 'weight must be an integer between 1 and 50' });
  }

  const kw = keyword.trim();
  const actor = getActingUser(req);
  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO pipeline.comply_keyword_library (keyword, category, weight, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, keyword, category, weight, description`,
      [kw, category, weightNum, description ?? null],
    );
    const row = result.rows[0];
    await pool.query(
      `INSERT INTO pipeline.comply_keyword_audit_log
         (action, keyword_id, keyword, category, weight, description, changed_by, changed_by_email)
       VALUES ('CREATE', $1, $2, $3, $4, $5, $6, $7)`,
      [row.id, row.keyword, row.category, row.weight, row.description, actor.sub, actor.email],
    );
    return res.status(201).json(row);
  } catch (err) {
    console.error('[settings/itar-keywords] POST failed:', err);
    return res.status(500).json({ error: 'Failed to add keyword' });
  } finally {
    await pool.end();
  }
});

// PATCH /settings/itar-keywords/:id
router.patch('/itar-keywords/:id', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid keyword id' });
  }

  const { category, weight, description } = req.body ?? {};

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  if (weight !== undefined) {
    const weightNum = Number(weight);
    if (!Number.isInteger(weightNum) || weightNum < 1 || weightNum > 50) {
      return res.status(400).json({ error: 'weight must be an integer between 1 and 50' });
    }
  }

  const actor = getActingUser(req);
  const pool = getPool();
  try {
    const prev = await pool.query(
      `SELECT id, keyword, category, weight, description FROM pipeline.comply_keyword_library WHERE id = $1`,
      [id],
    );
    if (prev.rowCount === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    const prevRow = prev.rows[0];

    const result = await pool.query(
      `UPDATE pipeline.comply_keyword_library
       SET category    = COALESCE($1, category),
           weight      = COALESCE($2, weight),
           description = COALESCE($3, description)
       WHERE id = $4
       RETURNING id, keyword, category, weight, description`,
      [category ?? null, weight !== undefined ? Number(weight) : null, description ?? null, id],
    );
    const row = result.rows[0];
    await pool.query(
      `INSERT INTO pipeline.comply_keyword_audit_log
         (action, keyword_id, keyword, category, weight, description,
          changed_by, changed_by_email, prev_category, prev_weight, prev_description)
       VALUES ('UPDATE', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [row.id, row.keyword, row.category, row.weight, row.description,
       actor.sub, actor.email, prevRow.category, prevRow.weight, prevRow.description],
    );
    return res.json(row);
  } catch (err) {
    console.error('[settings/itar-keywords] PATCH failed:', err);
    return res.status(500).json({ error: 'Failed to update keyword' });
  } finally {
    await pool.end();
  }
});

// DELETE /settings/itar-keywords/:id
router.delete('/itar-keywords/:id', requirePermission('SETTINGS_LLM'), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid keyword id' });
  }

  const actor = getActingUser(req);
  const pool = getPool();
  try {
    const prev = await pool.query(
      `SELECT id, keyword, category, weight, description FROM pipeline.comply_keyword_library WHERE id = $1`,
      [id],
    );
    if (prev.rowCount === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    const prevRow = prev.rows[0];

    await pool.query(`DELETE FROM pipeline.comply_keyword_library WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO pipeline.comply_keyword_audit_log
         (action, keyword_id, keyword, category, weight, description, changed_by, changed_by_email)
       VALUES ('DELETE', $1, $2, $3, $4, $5, $6, $7)`,
      [prevRow.id, prevRow.keyword, prevRow.category, prevRow.weight, prevRow.description,
       actor.sub, actor.email],
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[settings/itar-keywords] DELETE failed:', err);
    return res.status(500).json({ error: 'Failed to delete keyword' });
  } finally {
    await pool.end();
  }
});

// GET /settings/itar-keywords/audit-log
router.get('/itar-keywords/audit-log', requirePermission('SETTINGS_VIEW'), async (req: Request, res: Response) => {
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const pool = getPool();
  try {
    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, action, keyword_id, keyword, category, weight, description,
                changed_by, changed_by_email, changed_at,
                prev_category, prev_weight, prev_description
         FROM pipeline.comply_keyword_audit_log
         ORDER BY changed_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM pipeline.comply_keyword_audit_log`),
    ]);
    return res.json({ log: rows.rows, total: countRow.rows[0].total });
  } catch (err) {
    console.error('[settings/itar-keywords] audit-log GET failed:', err);
    return res.status(500).json({ error: 'Failed to read audit log' });
  } finally {
    await pool.end();
  }
});

export default router;
