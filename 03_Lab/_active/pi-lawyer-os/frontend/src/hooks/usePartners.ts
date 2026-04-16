import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { Partner, CreatePartnerInput } from '../types';

export const partnerKeys = {
  all: ['partners'] as const,
  list: (filters?: { active?: boolean; type?: string }) =>
    [...partnerKeys.all, 'list', filters ?? {}] as const,
  detail: (id: string) => [...partnerKeys.all, 'detail', id] as const,
};

export function usePartners(filters?: { active?: boolean; type?: string }) {
  return useQuery<Partner[]>({
    queryKey: partnerKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.active !== undefined) params.set('active', `eq.${filters.active}`);
      if (filters?.type) params.set('partner_type', `eq.${filters.type}`);
      params.set('order', 'name.asc');
      return apiGet<Partner[]>(`${API_BASE}/partners?${params.toString()}`);
    },
    staleTime: 60 * 1000,
  });
}

export function usePartner(id: string) {
  return useQuery<Partner>({
    queryKey: partnerKeys.detail(id),
    queryFn: () =>
      apiGet<Partner[]>(`${API_BASE}/partners?id=eq.${id}&limit=1`).then((r) => r[0]),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  return useMutation<Partner, Error, CreatePartnerInput>({
    mutationFn: (input) => apiPost<Partner>(`${API_BASE}/partners`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();
  return useMutation<Partner[], Error, { id: string; data: Partial<Partner> }>({
    mutationFn: ({ id, data }) =>
      apiPatch<Partner[]>(`${API_BASE}/partners?id=eq.${id}`, data),
    onSuccess: (rows, { id }) => {
      if (rows.length > 0) queryClient.setQueryData(partnerKeys.detail(id), rows[0]);
      queryClient.invalidateQueries({ queryKey: partnerKeys.list() });
    },
  });
}
