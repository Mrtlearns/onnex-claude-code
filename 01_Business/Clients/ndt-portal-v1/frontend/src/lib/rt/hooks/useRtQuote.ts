import { useState, useEffect, useCallback } from 'react';
import { rtApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { RtPartQuote, RtViewRow } from '../types';

export function useRtQuotes() {
  const { accessToken } = useAuth();
  const [quotes, setQuotes] = useState<RtPartQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    rtApi.list<RtPartQuote>('part_quotes', { order: 'created_at.desc' })
      .then(d => { setQuotes(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [accessToken]);

  const create = useCallback(async (data: Partial<RtPartQuote>) => {
    const row = await rtApi.create<RtPartQuote>('part_quotes', data);
    setQuotes(prev => [row, ...prev]);
    return row;
  }, []);

  const remove = useCallback(async (id: string) => {
    await rtApi.remove('part_quotes', id);
    setQuotes(prev => prev.filter(q => q.id !== id));
  }, []);

  return { quotes, loading, create, remove };
}

export function useRtViewRows(quoteId: string | null) {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<RtViewRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
    if (!quoteId) { setRows([]); return; }
    setLoading(true);
    rtApi.list<RtViewRow>('view_rows', { quote_id: `eq.${quoteId}`, order: 'sort_order' })
      .then(d => { setRows(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [accessToken, quoteId]);

  const addRow = useCallback(async (data: Partial<RtViewRow>) => {
    const row = await rtApi.create<RtViewRow>('view_rows', data);
    setRows(prev => [...prev, row]);
    return row;
  }, []);

  const updateRow = useCallback(async (id: string, changes: Partial<RtViewRow>) => {
    const row = await rtApi.update<RtViewRow>('view_rows', id, changes);
    setRows(prev => prev.map(r => r.id === id ? row : r));
  }, []);

  const removeRow = useCallback(async (id: string) => {
    await rtApi.remove('view_rows', id);
    setRows(prev => prev.filter(r => r.id !== id));
  }, []);

  return { rows, loading, addRow, updateRow, removeRow };
}
