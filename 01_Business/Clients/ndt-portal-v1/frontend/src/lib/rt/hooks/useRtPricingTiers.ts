import { useState, useEffect } from 'react';
import { rtApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { RtPricingTier } from '../types';

export function useRtPricingTiers() {
  const { accessToken } = useAuth();
  const [tiers, setTiers] = useState<RtPricingTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    rtApi.list<RtPricingTier>('pricing_tiers', { order: 'sort_order' })
      .then(d => { setTiers(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [accessToken]);

  return { tiers, loading };
}
