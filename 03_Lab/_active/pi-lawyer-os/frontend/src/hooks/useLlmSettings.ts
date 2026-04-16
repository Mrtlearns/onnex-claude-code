import { useState, useEffect } from 'react';
import { AUTH_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';

export interface LlmSettings {
  llm_provider: string;
  llm_model: string;
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...options, headers });
}

export function useLlmSettings() {
  const [settings, setSettings] = useState<LlmSettings>({ llm_provider: 'openrouter', llm_model: 'auto' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    authFetch(`${AUTH_BASE}/llm-settings`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSettings(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(next: LlmSettings) {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await authFetch(`${AUTH_BASE}/llm-settings`, {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Save failed');
      setSettings(next);
      setSaveResult({
        ok: true,
        msg: data.config_written
          ? `Saved. Using ${data.openclaw_model}. Restart Wyatt to apply.`
          : `Saved to database. Config file not updated (check mount).`,
      });
    } catch (err) {
      setSaveResult({ ok: false, msg: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSaving(false);
    }
  }

  return { settings, loading, saving, saveResult, save };
}
