import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete, API_BASE } from '../lib/api';
import type { CaseCost, CreateCaseCostInput } from '../types';

export const caseCostKeys = {
  all: ['case_costs'] as const,
  byCase: (caseId: string) => [...caseCostKeys.all, 'case', caseId] as const,
};

export function useCaseCosts(caseId: string) {
  return useQuery<CaseCost[]>({
    queryKey: caseCostKeys.byCase(caseId),
    queryFn: () =>
      apiGet<CaseCost[]>(
        `${API_BASE}/case_costs?case_id=eq.${caseId}&order=created_at.asc`
      ),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

export function useCreateCaseCost() {
  const queryClient = useQueryClient();
  return useMutation<CaseCost, Error, CreateCaseCostInput>({
    mutationFn: (input) =>
      apiPost<CaseCost>(`${API_BASE}/case_costs`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: caseCostKeys.byCase(variables.case_id),
      });
    },
  });
}

export function useUpdateCaseCost() {
  const queryClient = useQueryClient();
  return useMutation<
    CaseCost[],
    Error,
    { id: string; case_id: string; data: Partial<CaseCost> }
  >({
    mutationFn: ({ id, data }) =>
      apiPatch<CaseCost[]>(`${API_BASE}/case_costs?id=eq.${id}`, data),
    onSuccess: (_data, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: caseCostKeys.byCase(case_id) });
    },
  });
}

export function useDeleteCaseCost() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; case_id: string }>({
    mutationFn: ({ id }) => apiDelete(`${API_BASE}/case_costs?id=eq.${id}`),
    onSuccess: (_data, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: caseCostKeys.byCase(case_id) });
    },
  });
}
