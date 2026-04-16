import { useState, useEffect, useCallback } from 'react';
import { rtApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { RtSettings } from '../types';

export function useRtSettings() {
  const { accessToken } = useAuth();
  const [settings, setSettings] = useState<RtSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    rtApi.singleton<RtSettings>('settings')
      .then(s => { setSettings(s); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [accessToken]);

  const update = useCallback(async (changes: Partial<RtSettings>) => {
    if (!settings) return;
    const updated = await rtApi.update<RtSettings>('settings', settings.id, changes);
    setSettings(updated);
  }, [settings]);

  return { settings, loading, error, update };
}
