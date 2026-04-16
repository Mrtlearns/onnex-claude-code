import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../lib/api';
import type { Case, Client, MedicalProvider, Task, Document } from '../types';
import { caseKeys } from './useCases';

export interface CaseWithRelated {
  case: Case;
  client: Client | null;
  medical_providers: MedicalProvider[];
  tasks: Task[];
  documents: Document[];
}

export function useCase(id: string) {
  return useQuery<Case>({
    queryKey: caseKeys.detail(id),
    queryFn: () => apiGet<Case[]>(`${API_BASE}/cases?id=eq.${id}&limit=1`).then((r) => r[0]),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCaseClient(clientId: string | null | undefined) {
  return useQuery<Client | null>({
    queryKey: ['clients', 'detail', clientId],
    queryFn: () =>
      clientId
        ? apiGet<Client[]>(`${API_BASE}/clients?id=eq.${clientId}&limit=1`).then((r) => r[0] ?? null)
        : Promise.resolve(null),
    enabled: !!clientId,
    staleTime: 60 * 1000,
  });
}
