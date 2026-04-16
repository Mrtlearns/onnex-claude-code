import { useState, useEffect } from 'react';
import { rtApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { RtFilmSize } from '../types';

export function useRtFilmSizes() {
  const { accessToken } = useAuth();
  const [filmSizes, setFilmSizes] = useState<RtFilmSize[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    rtApi.list<RtFilmSize>('film_sizes', { order: 'sort_order' })
      .then(d => { setFilmSizes(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [accessToken]);

  return { filmSizes, loading };
}
