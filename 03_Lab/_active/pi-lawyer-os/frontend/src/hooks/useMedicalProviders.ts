import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { MedicalProvider } from '../types';

export const medicalProviderKeys = {
  all: ['medical_providers'] as const,
  byCase: (caseId: string) => [...medicalProviderKeys.all, 'case', caseId] as const,
};

type CreateMedicalProviderInput = Omit<MedicalProvider, 'id' | 'firm_id' | 'created_at' | 'updated_at'>;
interface UpdateMedicalProviderInput {
  id: string;
  data: Partial<Omit<MedicalProvider, 'id' | 'firm_id' | 'created_at' | 'updated_at'>>;
}

export function useMedicalProviders(caseId: string) {
  return useQuery<MedicalProvider[]>({
    queryKey: medicalProviderKeys.byCase(caseId),
    queryFn: () =>
      apiGet<MedicalProvider[]>(`${API_BASE}/medical_providers?case_id=eq.${caseId}&order=created_at.asc`),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

export function useMedicalProvidersSpecialsTotal(caseId: string) {
  const { data: providers } = useMedicalProviders(caseId);
  return (providers ?? []).reduce((sum, p) => sum + (p.lien_amount ?? 0), 0);
}

export function useCreateMedicalProvider() {
  const queryClient = useQueryClient();
  return useMutation<MedicalProvider, Error, CreateMedicalProviderInput>({
    mutationFn: (input) => apiPost<MedicalProvider>(`${API_BASE}/medical_providers`, input),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: medicalProviderKeys.byCase(input.case_id) });
    },
  });
}

export function useUpdateMedicalProvider() {
  const queryClient = useQueryClient();
  return useMutation<MedicalProvider[], Error, UpdateMedicalProviderInput>({
    mutationFn: ({ id, data }) =>
      apiPatch<MedicalProvider[]>(`${API_BASE}/medical_providers?id=eq.${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalProviderKeys.all });
    },
  });
}
