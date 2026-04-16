import { useState, useEffect, useCallback } from 'react';
import { utApi } from '../../api';
import { useAuth } from '../../../contexts/AuthContext';
import type { UtCustomer } from '../types';

export function useUtCustomers() {
  const { accessToken } = useAuth();
  const [customers, setCustomers] = useState<UtCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    utApi.list<UtCustomer>('customers', { order: 'sort_order' })
      .then(d => { setCustomers(d); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [accessToken]);

  const create = useCallback(async (data: Partial<UtCustomer>) => {
    const row = await utApi.create<UtCustomer>('customers', data);
    setCustomers(prev => [...prev, row]);
    return row;
  }, []);

  const update = useCallback(async (id: string, changes: Partial<UtCustomer>) => {
    const row = await utApi.update<UtCustomer>('customers', id, changes);
    setCustomers(prev => prev.map(c => c.id === id ? row : c));
  }, []);

  const remove = useCallback(async (id: string) => {
    await utApi.remove('customers', id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  return { customers, loading, create, update, remove };
}
