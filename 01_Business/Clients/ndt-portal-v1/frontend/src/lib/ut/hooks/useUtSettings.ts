import { useState, useEffect, useCallback } from 'react';
import { utApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { UtSettings } from '../types';

export function useUtSettings() {
  const { accessToken } = useAuth();
  const [settings, setSettings] = useState<UtSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    utApi.singleton<UtSettings>('global_settings')
      .then(s => { setSettings(s); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [accessToken]);

  const update = useCallback(async (changes: Partial<UtSettings>) => {
    if (!settings) return;
    const updated = await utApi.update<UtSettings>('global_settings', settings.id, changes);
    setSettings(updated);
  }, [settings]);

  return { settings, loading, update };
}
