import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { SettlementOffer, CreateSettlementOfferInput } from '../types';

export const settlementOfferKeys = {
  all: ['settlement_offers'] as const,
  byCase: (caseId: string) => [...settlementOfferKeys.all, 'case', caseId] as const,
};

export function useSettlementOffers(caseId: string) {
  return useQuery<SettlementOffer[]>({
    queryKey: settlementOfferKeys.byCase(caseId),
    queryFn: () =>
      apiGet<SettlementOffer[]>(
        `${API_BASE}/settlement_offers?case_id=eq.${caseId}&order=offered_at.desc`
      ),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

export function useCreateSettlementOffer() {
  const queryClient = useQueryClient();
  return useMutation<SettlementOffer, Error, CreateSettlementOfferInput>({
    mutationFn: (input) =>
      apiPost<SettlementOffer>(`${API_BASE}/settlement_offers`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: settlementOfferKeys.byCase(variables.case_id),
      });
    },
  });
}

export function useUpdateSettlementOffer() {
  const queryClient = useQueryClient();
  return useMutation<
    SettlementOffer[],
    Error,
    { id: string; case_id: string; data: Partial<SettlementOffer> }
  >({
    mutationFn: ({ id, data }) =>
      apiPatch<SettlementOffer[]>(`${API_BASE}/settlement_offers?id=eq.${id}`, data),
    onSuccess: (_data, { case_id }) => {
      queryClient.invalidateQueries({
        queryKey: settlementOfferKeys.byCase(case_id),
      });
    },
  });
}
