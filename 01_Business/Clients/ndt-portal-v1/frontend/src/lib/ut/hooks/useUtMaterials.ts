import { useState, useEffect } from 'react';
import { utApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { UtMaterial } from '../types';

export function useUtMaterials() {
  const { accessToken } = useAuth();
  const [materials, setMaterials] = useState<UtMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    utApi.list<UtMaterial>('materials', { order: 'sort_order' })
      .then(d => { setMaterials(d); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [accessToken]);

  return { materials, loading };
}
