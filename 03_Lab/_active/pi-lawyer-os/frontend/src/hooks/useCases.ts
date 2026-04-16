import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { Case, CaseStatus } from '../types';

export const caseKeys = {
  all: ['cases'] as const,
  list: (filters?: { status?: CaseStatus; attorney?: string; sol_warning?: boolean }) =>
    [...caseKeys.all, 'list', filters ?? {}] as const,
  detail: (id: string) => [...caseKeys.all, 'detail', id] as const,
};

type CreateCaseInput = Omit<Case, 'id' | 'firm_id' | 'attorney_fee_pct' | 'opened_at' | 'closed_at' | 'created_at' | 'updated_at'>;
interface UpdateCaseInput {
  id: string;
  data: Partial<Omit<Case, 'id' | 'firm_id' | 'created_at' | 'updated_at'>>;
}

export function useCases(filters?: { status?: CaseStatus; attorney?: string; sol_warning?: boolean }) {
  return useQuery<Case[]>({
    queryKey: caseKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', `eq.${filters.status}`);
      if (filters?.attorney) params.set('assigned_attorney', `eq.${filters.attorney}`);
      params.set('order', 'sol_date.asc.nullslast,created_at.desc');
      params.set('select', '*,client:clients(first_name,last_name)');
      return apiGet<Case[]>(`${API_BASE}/cases?${params.toString()}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation<Case, Error, CreateCaseInput>({
    mutationFn: (input) =>
      apiPost<Case>(`${API_BASE}/cases`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.all });
    },
  });
}

export function useUpdateCase() {
  const queryClient = useQueryClient();
  return useMutation<Case[], Error, UpdateCaseInput>({
    mutationFn: ({ id, data }) =>
      apiPatch<Case[]>(`${API_BASE}/cases?id=eq.${id}`, data),
    onSuccess: (rows, { id }) => {
      if (rows.length > 0) queryClient.setQueryData(caseKeys.detail(id), rows[0]);
      queryClient.invalidateQueries({ queryKey: caseKeys.list() });
    },
  });
}
