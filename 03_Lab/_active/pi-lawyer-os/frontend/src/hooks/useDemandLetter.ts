import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '../lib/api';
import type { DemandLetter } from '../types';

const AI_BASE = '/ai';

export const demandKeys = {
  all: ['demand'] as const,
  byCase: (caseId: string) => [...demandKeys.all, caseId] as const,
};

// ── Fetch existing demand letter ──────────────────────────────────────────────

export function useDemandLetter(caseId: string | undefined) {
  return useQuery<DemandLetter>({
    queryKey: demandKeys.byCase(caseId ?? ''),
    queryFn: () => apiGet<DemandLetter>(`${AI_BASE}/demand/${caseId}`),
    enabled: !!caseId,
    staleTime: 30 * 1000,
    retry: false,
  });
}

// ── Generate demand letter ────────────────────────────────────────────────────

export function useGenerateDemandLetter() {
  const queryClient = useQueryClient();
  return useMutation<DemandLetter, Error, { case_id: string }>({
    mutationFn: ({ case_id }) =>
      apiPost<DemandLetter>(`${AI_BASE}/generate-demand/${case_id}`, {}),
    onSuccess: (_, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: demandKeys.byCase(case_id) });
    },
  });
}

// ── Update (save edits to) demand letter ──────────────────────────────────────

export function useUpdateDemandLetter() {
  const queryClient = useQueryClient();
  return useMutation<DemandLetter, Error, { case_id: string; content: string }>({
    mutationFn: ({ case_id, content }) =>
      apiPatch<DemandLetter>(`${AI_BASE}/demand/${case_id}`, { content }),
    onSuccess: (_, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: demandKeys.byCase(case_id) });
    },
  });
}
