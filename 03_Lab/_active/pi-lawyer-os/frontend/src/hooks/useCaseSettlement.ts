import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { CaseSettlement, CreateCaseSettlementInput } from '../types';

export const caseSettlementKeys = {
  all: ['case_settlements'] as const,
  byCase: (caseId: string) => [...caseSettlementKeys.all, 'case', caseId] as const,
};

export function useCaseSettlement(caseId: string) {
  return useQuery<CaseSettlement | null>({
    queryKey: caseSettlementKeys.byCase(caseId),
    queryFn: async () => {
      const rows = await apiGet<CaseSettlement[]>(
        `${API_BASE}/case_settlements?case_id=eq.${caseId}&limit=1`
      );
      return rows[0] ?? null;
    },
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

export function useCreateCaseSettlement() {
  const queryClient = useQueryClient();
  return useMutation<CaseSettlement, Error, CreateCaseSettlementInput>({
    mutationFn: (input) =>
      apiPost<CaseSettlement>(`${API_BASE}/case_settlements`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: caseSettlementKeys.byCase(variables.case_id),
      });
    },
  });
}

export function useUpdateCaseSettlement() {
  const queryClient = useQueryClient();
  return useMutation<
    CaseSettlement[],
    Error,
    { id: string; case_id: string; data: Partial<Omit<CaseSettlement, 'attorney_fee_amount' | 'net_to_client'>> }
  >({
    mutationFn: ({ id, data }) =>
      apiPatch<CaseSettlement[]>(`${API_BASE}/case_settlements?id=eq.${id}`, data),
    onSuccess: (_data, { case_id }) => {
      queryClient.invalidateQueries({
        queryKey: caseSettlementKeys.byCase(case_id),
      });
    },
  });
}
