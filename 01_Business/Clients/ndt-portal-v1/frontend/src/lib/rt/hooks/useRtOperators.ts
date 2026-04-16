import { useState, useEffect, useCallback } from 'react';
import { rtApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { RtOperator } from '../types';

export function useRtOperators() {
  const { accessToken } = useAuth();
  const [operators, setOperators] = useState<RtOperator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    rtApi.list<RtOperator>('operators', { order: 'sort_order' })
      .then(d => { setOperators(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [accessToken]);

  const update = useCallback(async (id: string, changes: Partial<RtOperator>) => {
    const row = await rtApi.update<RtOperator>('operators', id, changes);
    setOperators(prev => prev.map(o => o.id === id ? row : o));
  }, []);

  return { operators, loading, update };
}
